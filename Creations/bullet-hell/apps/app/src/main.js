import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'
import { createRenderer } from './engine/renderer2d.js'
import { QuadTree } from './engine/quadtree.js'
import { createWorld, spawnEnemy, firePlayerBullet, fireEnemyBullet, updateWorld, clampPlayer, recycleAllEnemyBullets, recycleEnemyBulletsWithinRadius } from './engine/entities.js'
import config from './config.js'

// Configure viewport for device-like behavior
uiDesign.setupViewport()
deviceControls.init()

const canvas = document.getElementById('glcanvas')
const renderer = createRenderer(canvas)

// World setup
const world = createWorld()
// Initial player spawn
world.player.x = 0
world.player.y = -world.height + (config.world.bottomYOffsetPx || 24)
world.player.lives = config.world.playerLives

// FPS overlay (rolling 1s window, avg and 1% low)
const fpsEl = document.createElement('div')
fpsEl.style.position = 'fixed'
fpsEl.style.left = '8px'
fpsEl.style.top = (config.ui.perfOffsetTopPx != null ? String(config.ui.perfOffsetTopPx) : '8') + 'px'
fpsEl.style.padding = '4px 6px'
fpsEl.style.background = 'rgba(0,0,0,0.5)'
fpsEl.style.color = '#0f0'
fpsEl.style.fontFamily = 'monospace'
fpsEl.style.fontSize = '12px'
fpsEl.style.zIndex = '1000'
fpsEl.style.pointerEvents = 'none'
fpsEl.style.whiteSpace = 'pre'
if (config.ui.showPerfOverlay) document.body.appendChild(fpsEl)

// Score overlay
const scoreEl = document.createElement('div')
scoreEl.style.position = 'fixed'
scoreEl.style.right = '8px'
scoreEl.style.top = '8px'
scoreEl.style.padding = '4px 6px'
scoreEl.style.background = 'rgba(0,0,0,0.5)'
scoreEl.style.color = '#0f0'
scoreEl.style.fontFamily = 'monospace'
scoreEl.style.fontSize = '12px'
scoreEl.style.zIndex = '1000'
scoreEl.style.pointerEvents = 'none'
scoreEl.style.whiteSpace = 'pre'
scoreEl.style.textAlign = 'right'
document.body.appendChild(scoreEl)

const fpsWindowMs = 1000
let fpsDurationsMs = []
let fpsSumMs = 0
let renderPrevTimeMs = performance.now()
let useVsync = false

// Input state (keyboard)
const keys = new Set()
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase())
})
window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase())
})

// Fire control via space or side button
let fireHeld = false
window.addEventListener('keydown', (e) => { if (e.code === 'Space') fireHeld = true })
window.addEventListener('keyup', (e) => { if (e.code === 'Space') fireHeld = false })
// Side button will be used to restart when game over
let restartRequested = false
deviceControls.on('sideButton', () => { restartRequested = true })

// Scroll wheel: add horizontal velocity impulse with ramping
deviceControls.on('scrollWheel', ({ direction }) => {
  const p = world.player
  if (!p.alive) return
  const now = performance.now()
  const dir = direction === 'up' ? 1 : -1
  if (dir === lastScrollDir && (now - lastScrollTimeMs) < rampWindowMs) perScrollCount += 1
  else perScrollCount = 1
  lastScrollTimeMs = now
  lastScrollDir = dir
  hVel += dir * perScrollCount * scrollImpulse
})

// Spawning
let enemySpawnTimer = 0
let enemyFireTimer = 0
let playerFireTimer = 0

// Scoring
let score = 0
let combo = 0
let highScore = 0
try { highScore = parseInt(localStorage.getItem(config.scoring.highScoreKey) || '0', 10) || 0 } catch (_) { highScore = 0 }
function formatScore(n) {
  return String((n|0) < 0 ? 0 : (n|0)).padStart(8, '0')
}

// Horizontal velocity-based movement (scroll impulses + key accel)
let hVel = 0
let lastScrollTimeMs = 0
let lastScrollDir = 0 // +1 up/right, -1 down/left
let perScrollCount = 1
const rampWindowMs = 2000
const decayRate = config.player.frictionPerSec // s^-1 friction
const scrollImpulse = config.player.scrollImpulse // px/s increment per event, ramps
const keyAccel = config.player.keyAccel // px/s^2
const maxKeySpeed = config.player.maxKeySpeed // px/s cap from keys

// Instance buffer assembly
const MAX_VISIBLE = 16384
const floatsPerInstance = renderer.floatsPerInstance
let flat = new Float32Array(MAX_VISIBLE * floatsPerInstance)
let flatCount = 0

function pushInstance(x, y, sx, sy, rot, r, g, b) {
  const i = flatCount * floatsPerInstance
  if (i + floatsPerInstance > flat.length) return
  flat[i] = x; flat[i + 1] = y
  flat[i + 2] = sx; flat[i + 3] = sy
  flat[i + 4] = rot
  flat[i + 5] = r; flat[i + 6] = g; flat[i + 7] = b
  flatCount++
}

function aabbIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
  return !(ax + aw * 0.5 < bx - bw * 0.5 ||
           bx + bw * 0.5 < ax - aw * 0.5 ||
           ay + ah * 0.5 < by - bh * 0.5 ||
           by + bh * 0.5 < ay - ah * 0.5)
}

function render(timeMs) {
  const { width, height } = renderer.resize()
  world.width = width * 0.5
  world.height = height * 0.5

  // FPS tracking
  const frameDtMs = timeMs - renderPrevTimeMs
  renderPrevTimeMs = timeMs
  fpsDurationsMs.push(frameDtMs)
  fpsSumMs += frameDtMs
  while (fpsSumMs > fpsWindowMs && fpsDurationsMs.length > 0) fpsSumMs -= fpsDurationsMs.shift()
  if (fpsDurationsMs.length > 0 && config.ui.showPerfOverlay) {
    const n = fpsDurationsMs.length
    const avgDt = fpsSumMs / n
    const avgFps = 1000 / Math.max(0.0001, avgDt)
    const fpsSamples = fpsDurationsMs.map(d => 1000 / Math.max(0.0001, d)).sort((a, b) => a - b)
    const idx = Math.max(0, Math.floor(0.01 * n))
    const low1 = fpsSamples[idx]
    fpsEl.textContent = `fps ${avgFps.toFixed(1)}\n1% ${low1.toFixed(1)}\nvsync ${useVsync ? 'on' : 'off'}`
  }
  // Update score UI
  scoreEl.textContent = `score ${formatScore(score)}\nhi ${formatScore(highScore)}`

  const dt = Math.max(0, Math.min(0.05, frameDtMs * 0.001))

  // Input → player
  const p = world.player
  const moveSpeedY = config.player.moveSpeedY
  let mx = 0, my = 0
  if (keys.has('arrowleft') || keys.has('a')) mx -= 1
  if (keys.has('arrowright') || keys.has('d')) mx += 1
  if (keys.has('arrowup') || keys.has('w')) my -= 1
  if (keys.has('arrowdown') || keys.has('s')) my += 1
  // Vertical direct movement
  if (my !== 0) {
    const ny = my / Math.abs(my)
    p.y += ny * moveSpeedY * dt
  }
  // Horizontal affects velocity with acceleration and clamped max (from keys)
  if (mx !== 0) {
    const nx = mx / Math.abs(mx)
    hVel += nx * keyAccel * dt
    if (Math.abs(hVel) > maxKeySpeed) hVel = Math.sign(hVel) * maxKeySpeed
  }
  // Apply horizontal velocity with exponential decay (friction)
  const decay = Math.exp(-decayRate * dt)
  hVel *= decay
  p.x += hVel * dt
  clampPlayer(world)

  // On first frame after resize ensure bottom spawn
  if (world.time === 0) {
    p.x = 0
    p.y = -world.height + (config.world.bottomYOffsetPx || 24) // bottom edge in our coord system (positive y up)
  }

  // Spawning
  enemySpawnTimer -= dt
  if (enemySpawnTimer <= 0) {
    const ex = (Math.random() * 2 - 1) * (world.width - 20)
    // Spawn at the top edge and move downward (negative vy) with config speed range
    const spd = -(config.enemy.speedMin + Math.random() * (config.enemy.speedMax - config.enemy.speedMin))
    spawnEnemy(world, ex, world.height - 20, spd)
    // Dynamic interval: base minus elapsed*accel, clamped
    const base = config.enemy.spawn.baseInterval
    const dec = (config.enemy.spawn.accelPerSec || 0) * world.time
    enemySpawnTimer = Math.max(config.enemy.spawn.minInterval, base - dec)
  }
  enemyFireTimer -= dt
  if (enemyFireTimer <= 0 && world.enemies.length > 0 && p.alive) {
    const e = world.enemies[(Math.random() * world.enemies.length) | 0]
    const dx = p.x - e.x, dy = p.y - e.y
    const bs = config.enemy.bulletSpeedMin + Math.random() * (config.enemy.bulletSpeedMax - config.enemy.bulletSpeedMin)
    fireEnemyBullet(world, e.x, e.y, dx, dy, bs)
    enemyFireTimer = config.enemy.fireInterval
  }
  // Auto-shoot player (shoot upward) with spread
  playerFireTimer -= dt
  if (p.alive && playerFireTimer <= 0) {
    const n = Math.max(1, config.player.spray.count|0)
    const spread = (config.player.spray.spreadDeg || 0) * Math.PI / 180
    const centerAngle = Math.PI/2 // up
    const start = centerAngle - spread/2
    const step = n > 1 ? spread / (n - 1) : 0
    for (let i = 0; i < n; i++) {
      const ang = start + step * i
      const dx = Math.cos(ang), dy = Math.sin(ang)
      firePlayerBullet(world, p.x, p.y + 12, dx, dy, config.player.autoBulletSpeed)
    }
    playerFireTimer = config.player.autoFireInterval
  }

  // Integrate
  updateWorld(world, dt)

  // Game over / restart
  if (!p.alive && p.lives <= 0) {
    if (restartRequested) {
      // Reset world
      world.time = 0
      world.enemies.length = 0
      world.playerBullets.length = 0
      recycleAllEnemyBullets(world)
      p.x = 0
      p.y = -world.height + (config.world.bottomYOffsetPx || 24)
      p.alive = true
      p.lives = config.world.playerLives
      p.invincibleUntil = performance.now() + (config.world.playerInvincibleMs || 2000)
      hVel = 0
      enemySpawnTimer = config.enemy.spawn.baseInterval
      score = 0
      combo = 0
      restartRequested = false
    }
  } else {
    restartRequested = false
  }

  // Collisions
  // QuadTree of enemies for player-bullet queries
  const qt = new QuadTree({ x: -world.width, y: -world.height, w: world.width * 2, h: world.height * 2 }, 8, 7)
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i]
    qt.insertRect(e.x - e.w * 0.5, e.y - e.h * 0.5, e.w, e.h, i)
  }
  // Player bullets vs enemies via quadtree
  for (let bi = 0; bi < world.playerBullets.length; bi++) {
    const b = world.playerBullets[bi]
    const bx = b.x - b.w * 0.5, by = b.y - b.h * 0.5
    const candidates = qt.queryRect(bx, by, b.w, b.h, [])
    let hit = false
    for (let c = 0; c < candidates.length; c++) {
      const idx = candidates[c].ref
      const e = world.enemies[idx]
      if (!e) continue
      if (aabbIntersect(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) {
        e.hp -= 1
        // remove bullet
        world.playerBullets[bi] = world.playerBullets[world.playerBullets.length - 1]
        world.playerBullets.pop(); bi--
        hit = true
        if (e.hp <= 0) {
          // score and combo
          combo = Math.min(config.scoring.comboMax, combo + 1)
          const gain = (config.scoring.enemyKillBase * Math.max(1, combo)) | 0
          score += gain
          if (score > highScore) { highScore = score; try { localStorage.setItem(config.scoring.highScoreKey, String(highScore)) } catch (_) {} }
          world.enemies[idx] = world.enemies[world.enemies.length - 1]
          world.enemies.pop()
        }
        break
      }
    }
    if (hit) continue
  }
  // Enemy bullets vs player center (1px)
  if (world.player.alive) {
    for (let i = 0; i < world.enemyBullets.length; i++) {
      const b = world.enemyBullets[i]
      if (performance.now() < p.invincibleUntil) continue
      if (aabbIntersect(world.player.x, world.player.y, 1, 1, b.x, b.y, b.w, b.h)) {
        // lose a life, respawn with invincibility
        p.lives -= 1
        combo = 0
        if (p.lives > 0) {
          p.x = 0
          p.y = -world.height + (config.world.bottomYOffsetPx || 24)
          p.invincibleUntil = performance.now() + (config.world.playerInvincibleMs || 2000)
          // clear nearby bullets to avoid instant hit
          recycleEnemyBulletsWithinRadius(world, p.x, p.y, 32)
          hVel = 0
        } else {
          p.alive = false
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200)
        }
        break
      }
    }
  }

  // Build instances and draw
  flatCount = 0
  renderer.beginFrame()
  // Player (blink while invincible)
  if (p.alive) {
    const inv = performance.now() < p.invincibleUntil
    const blink = inv ? ((Math.floor(performance.now() * 0.01) % 2) === 0) : true
    if (blink) pushInstance(p.x, p.y, 14, 18, 0, 0.2, 0.9, 1.0)
  } else {
    // Game over banner as a large triangle centered
    // Optional: could render text; keep simple
  }
  // Enemies
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i]
    pushInstance(e.x, e.y, 18, 22, Math.PI, 1.0, 0.3, 0.3)
  }
  // Player bullets
  for (let i = 0; i < world.playerBullets.length; i++) {
    const b = world.playerBullets[i]
    const rot = Math.atan2(b.vy, b.vx) - Math.PI * 0.5
    pushInstance(b.x, b.y, 6, 10, rot, 1.0, 1.0, 0.4)
  }
  // Enemy bullets
  for (let i = 0; i < world.enemyBullets.length; i++) {
    const b = world.enemyBullets[i]
    const rot = Math.atan2(b.vy, b.vx) - Math.PI * 0.5
    pushInstance(b.x, b.y, 6, 10, rot, 1.0, 0.4, 1.0)
  }
  renderer.setInstances(flat, flatCount)
  renderer.draw()

  scheduleNext()
}

// Ensure canvas has CSS size for clientWidth/clientHeight
function ensureCanvasCssSize() {
  if (!canvas.style.width) canvas.style.width = '100vw'
  if (!canvas.style.height) canvas.style.height = '100vh'
  canvas.style.display = 'block'
}

ensureCanvasCssSize()
scheduleNext()

// VSync toggle/scheduler (vsync off by default)
function scheduleNext() {
  if (useVsync) requestAnimationFrame(render)
  else setTimeout(() => render(performance.now()), 0)
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'v' || e.key === 'V') useVsync = !useVsync
})


