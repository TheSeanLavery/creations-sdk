import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'
import { createRenderer } from './engine/renderer2d.js'
import { QuadTree } from './engine/quadtree.js'
import { createWorld, spawnEnemy, firePlayerBullet, fireEnemyBullet, updateWorld, clampPlayer } from './engine/entities.js'

// Configure viewport for device-like behavior
uiDesign.setupViewport()
deviceControls.init()

const canvas = document.getElementById('glcanvas')
const renderer = createRenderer(canvas)

// World setup
const world = createWorld()
// Initial player spawn
world.player.x = 0
world.player.y = -world.height + 24

// FPS overlay (rolling 1s window, avg and 1% low)
const fpsEl = document.createElement('div')
fpsEl.style.position = 'fixed'
fpsEl.style.left = '8px'
fpsEl.style.top = '8px'
fpsEl.style.padding = '4px 6px'
fpsEl.style.background = 'rgba(0,0,0,0.5)'
fpsEl.style.color = '#0f0'
fpsEl.style.fontFamily = 'monospace'
fpsEl.style.fontSize = '12px'
fpsEl.style.zIndex = '1000'
fpsEl.style.pointerEvents = 'none'
document.body.appendChild(fpsEl)

const fpsWindowMs = 1000
let fpsDurationsMs = []
let fpsSumMs = 0
let renderPrevTimeMs = performance.now()
let useVsync = true

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

// Horizontal velocity-based movement (scroll impulses + key accel)
let hVel = 0
let lastScrollTimeMs = 0
let lastScrollDir = 0 // +1 up/right, -1 down/left
let perScrollCount = 1
const rampWindowMs = 2000
const decayRate = 3 // s^-1 friction
const scrollImpulse = 40 // px/s increment per event, ramps
const keyAccel = 1200 // px/s^2
const maxKeySpeed = 320 // px/s cap from keys

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
  if (fpsDurationsMs.length > 0) {
    const n = fpsDurationsMs.length
    const avgDt = fpsSumMs / n
    const avgFps = 1000 / Math.max(0.0001, avgDt)
    const fpsSamples = fpsDurationsMs.map(d => 1000 / Math.max(0.0001, d)).sort((a, b) => a - b)
    const idx = Math.max(0, Math.floor(0.01 * n))
    const low1 = fpsSamples[idx]
    fpsEl.textContent = `fps ${avgFps.toFixed(1)} | 1% ${low1.toFixed(1)} | vsync ${useVsync ? 'on' : 'off'}`
  }

  const dt = Math.max(0, Math.min(0.05, frameDtMs * 0.001))

  // Input → player
  const p = world.player
  const moveSpeedY = 180
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
    p.y = -world.height + 24 // bottom edge in our coord system (positive y up), bottom is -height
  }

  // Spawning
  enemySpawnTimer -= dt
  if (enemySpawnTimer <= 0) {
    const ex = (Math.random() * 2 - 1) * (world.width - 20)
    // Spawn at the top edge and move downward (negative vy)
    spawnEnemy(world, ex, world.height - 20, -(40 + Math.random() * 30))
    enemySpawnTimer = 0.75
  }
  enemyFireTimer -= dt
  if (enemyFireTimer <= 0 && world.enemies.length > 0 && p.alive) {
    const e = world.enemies[(Math.random() * world.enemies.length) | 0]
    const dx = p.x - e.x, dy = p.y - e.y
    fireEnemyBullet(world, e.x, e.y, dx, dy, 140 + Math.random() * 60)
    enemyFireTimer = 0.6
  }
  // Auto-shoot player (shoot upward)
  playerFireTimer -= dt
  if (p.alive && playerFireTimer <= 0) {
    firePlayerBullet(world, p.x, p.y + 12, 0, 1, 300)
    playerFireTimer = 0.09
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
      world.enemyBullets.length = 0
      p.x = 0
      p.y = -world.height + 24
      p.alive = true
      p.lives = 3
      p.invincibleUntil = performance.now() + 2000
      hVel = 0
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
        if (p.lives > 0) {
          p.x = 0
          p.y = -world.height + 24
          p.invincibleUntil = performance.now() + 2000
          // clear nearby bullets to avoid instant hit
          world.enemyBullets = world.enemyBullets.filter(bb => Math.hypot(bb.x - p.x, bb.y - p.y) > 32)
          hVel = 0
        } else {
          p.alive = false
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


