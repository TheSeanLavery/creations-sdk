import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'
import { createRenderer } from './engine/renderer2d.js'
import { QuadTree } from './engine/quadtree.js'
import { createWorld, spawnEnemy, firePlayerBullet, fireEnemyBullet, updateWorld, clampPlayer, recycleAllEnemyBullets, recycleEnemyBulletsWithinRadius } from './engine/entities.js'
import { levels } from './config/levels.js'
import { enemies as enemyArchetypes } from './config/enemies.js'
import engine from './config/engine.js'
import { ShotEmitter } from './lib/shot-emitter.js'
import { TimelineRunner } from './lib/timeline-runner.js'
import { EnemyController } from './lib/enemy-controller.js'
import { deriveSeed, createRng } from './lib/rng.js'
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
fpsEl.style.pointerEvents = 'auto'
fpsEl.style.whiteSpace = 'pre'
let showPerfOverlay = !!config.ui.showPerfOverlay
document.body.appendChild(fpsEl)
fpsEl.addEventListener('click', () => { showPerfOverlay = !showPerfOverlay; fpsEl.style.opacity = showPerfOverlay ? '1' : '0' })
fpsEl.style.opacity = showPerfOverlay ? '1' : '0'

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

// Boss HP bar (global)
const bossBarWrap = document.createElement('div')
bossBarWrap.style.position = 'fixed'
bossBarWrap.style.left = '50%'
bossBarWrap.style.top = '8px'
bossBarWrap.style.transform = 'translateX(-50%)'
bossBarWrap.style.width = '60%'
bossBarWrap.style.height = '10px'
bossBarWrap.style.background = 'rgba(255,255,255,0.1)'
bossBarWrap.style.border = '1px solid rgba(255,255,255,0.3)'
bossBarWrap.style.borderRadius = '6px'
bossBarWrap.style.overflow = 'hidden'
bossBarWrap.style.zIndex = '1000'
bossBarWrap.setAttribute('data-testid', 'boss-hp-bar')
const bossBarFill = document.createElement('div')
bossBarFill.style.height = '100%'
bossBarFill.style.width = '0%'
bossBarFill.style.background = 'linear-gradient(90deg, #f44, #f8a)'
bossBarWrap.appendChild(bossBarFill)
document.body.appendChild(bossBarWrap)
bossBarWrap.style.display = 'none'

// Level complete overlay + Continue button
const completeEl = document.createElement('div')
completeEl.style.position = 'fixed'
completeEl.style.left = '50%'
completeEl.style.top = '50%'
completeEl.style.transform = 'translate(-50%, -50%)'
completeEl.style.background = 'rgba(0,0,0,0.7)'
completeEl.style.color = '#fff'
completeEl.style.padding = '16px 20px'
completeEl.style.border = '1px solid rgba(255,255,255,0.25)'
completeEl.style.borderRadius = '8px'
completeEl.style.fontFamily = 'monospace'
completeEl.style.fontSize = '14px'
completeEl.style.zIndex = '1200'
completeEl.style.textAlign = 'center'
completeEl.style.whiteSpace = 'pre'
completeEl.setAttribute('data-testid', 'level-complete')
completeEl.style.display = 'none'
document.body.appendChild(completeEl)

// Message container so we don't overwrite button
const completeMsg = document.createElement('div')
completeMsg.style.marginBottom = '8px'
completeEl.appendChild(completeMsg)

const continueBtn = document.createElement('button')
continueBtn.textContent = 'Continue'
continueBtn.style.marginTop = '8px'
continueBtn.style.padding = '6px 10px'
continueBtn.style.fontFamily = 'monospace'
continueBtn.style.fontSize = '14px'
continueBtn.style.cursor = 'pointer'
continueBtn.addEventListener('click', () => {
  // advance to next level if exists, otherwise show win screen
  if (runner.levelIndex + 1 < levels.length) {
    runner.loadLevel(runner.levelIndex + 1)
    completeEl.style.display = 'none'
  } else {
    // show you win
    completeMsg.textContent = `YOU WIN\n\nscore ${formatScore(score)}\nhi ${formatScore(highScore)}\ncombo_peak ${formatScore(comboPeak)}\nmisses ${formatScore(misses)}`
    continueBtn.style.display = 'none'
    completeEl.style.display = 'block'
  }
})
completeEl.appendChild(continueBtn)

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
let playerFireTimer = 0

// Systems: shot emitter, controllers, timeline runner
const controllers = new WeakMap()
const shotEmitter = new ShotEmitter({ fireEnemyBullet: (x, y, dx, dy, speed, extra) => fireEnemyBullet(world, x, y, dx, dy, speed, extra) })
const runner = new TimelineRunner(levels[0], world, {
  spawnEnemyById: (enemyId, { lane, rng }) => spawnEnemyById(enemyId, lane, rng),
  hasLivingById: (enemyId) => {
    for (let i = 0; i < world.enemies.length; i++) if (world.enemies[i]._enemyId === enemyId) return true
    return false
  },
}, 0, levels)

function spawnEnemyById(enemyId, lane, rng) {
  const arch = enemyArchetypes[enemyId]
  if (!arch) return
  // compute off-screen start
  const margin = 30
  let x = 0, y = world.height + margin
  if (lane === 'topRandom' || !lane) {
    const rr = rng && typeof rng.next === 'function' ? (rng.next() * 2 - 1) : (Math.random() * 2 - 1)
    const r = rr
    x = r * (world.width - 20)
    y = world.height + margin
  } else if (lane === 'topLeftRightOffscreen') {
    const left = (rng && typeof rng.next === 'function' ? rng.next() : Math.random()) < 0.5
    x = (left ? -world.width - margin : world.width + margin)
    y = world.height - 20
  }
  // choose initial velocities
  let vy = -80
  if (arch.movement?.use === 'gunshipSweep') vy = 0
  if (arch.movement?.use === 'bursterStopAndBurst') vy = -60
  if (arch.movement?.use === 'popcornDrift') vy = -100
  spawnEnemy(world, x, y, vy)
  const e = world.enemies[world.enemies.length - 1]
  if (!e) return
  e._enemyId = enemyId
  e._maxHp = arch.hp != null ? arch.hp : e.hp
  // override size and hp from archetype
  if (arch.size) { e.w = arch.size.w; e.h = arch.size.h }
  if (arch.hp != null) e.hp = arch.hp
  // gunship horizontal sweep
  if (arch.movement?.use === 'gunshipSweep') {
    e.vx = (x < 0 ? Math.abs(arch.movement.params?.vx || 70) : -Math.abs(arch.movement.params?.vx || 70))
  }
  // attach controller
  const controller = new EnemyController(world, e, arch, {
    fireShot: (shotRef, origin, facing, rng2) => shotEmitter.emit(shotRef, origin, facing, rng2),
  }, createRng(deriveSeed((rng && rng.state) ? rng.state : 1, enemyId + ':' + String(world.enemies.length))))
  controllers.set(e, controller)
}

// Scoring
let score = 0
let combo = 0
let highScore = 0
let comboPeak = 0
let misses = 0
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

// Instance buffer assembly (CPU-side, grows dynamically)
const floatsPerInstance = renderer.floatsPerInstance
let flatCapacity = 16384
let flat = new Float32Array(flatCapacity * floatsPerInstance)
let flatCount = 0

function ensureFlatCapacity(minInstances) {
  if (minInstances <= flatCapacity) return
  let next = flatCapacity
  while (next < minInstances) next *= 2
  const newFlat = new Float32Array(next * floatsPerInstance)
  newFlat.set(flat.subarray(0, flatCount * floatsPerInstance))
  flat = newFlat
  flatCapacity = next
}

function pushInstance(x, y, sx, sy, rot, r, g, b) {
  if (flatCount + 1 > flatCapacity) ensureFlatCapacity(flatCount + 1)
  const i = flatCount * floatsPerInstance
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
  if (window.__debug) window.__debug.frameCount = (window.__debug.frameCount|0) + 1

  // FPS tracking
  const frameDtMs = timeMs - renderPrevTimeMs
  renderPrevTimeMs = timeMs
  fpsDurationsMs.push(frameDtMs)
  fpsSumMs += frameDtMs
  while (fpsSumMs > fpsWindowMs && fpsDurationsMs.length > 0) fpsSumMs -= fpsDurationsMs.shift()
  if (fpsDurationsMs.length > 0 && showPerfOverlay) {
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

  const dt = Math.max(0, Math.min(1/Math.max(1, engine.fpsCap || 60), frameDtMs * 0.001))

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

  // Timeline-driven spawns
  runner.update(dt)
  // Update enemy controllers (movement and firing)
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i]
    let c = controllers.get(e)
    if (!c && e._enemyId && enemyArchetypes[e._enemyId]) {
      c = new EnemyController(world, e, enemyArchetypes[e._enemyId], { fireShot: (shotRef, origin, facing, rng2) => shotEmitter.emit(shotRef, origin, facing, rng2) }, null)
      controllers.set(e, c)
    }
    if (c) c.update(dt, world.time, world.player)
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
      const sine = config.player.spray.sine || { amplitude: 0, frequencyHz: 0 }
      firePlayerBullet(world, p.x, p.y + 12, dx, dy, config.player.autoBulletSpeed, { sineAmp: sine.amplitude || 0, sineFreqHz: sine.frequencyHz || 0 })
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
      score = 0
      combo = 0
      restartRequested = false
    }
  } else {
    restartRequested = false
  }

  // Game Over overlay
  if (!p.alive && p.lives <= 0) {
    completeEl.textContent = `GAME OVER\n\nscore ${formatScore(score)}\nhi ${formatScore(highScore)}\ncombo_peak ${formatScore(comboPeak)}\nmisses ${formatScore(misses)}`
    completeEl.style.display = 'block'
    continueBtn.style.display = 'none'
  } else {
    continueBtn.style.display = 'inline-block'
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
          if (combo > comboPeak) comboPeak = combo
          const gain = (config.scoring.enemyKillBase * Math.max(1, combo)) | 0
          score += gain
          if (score > highScore) { highScore = score; try { localStorage.setItem(config.scoring.highScoreKey, String(highScore)) } catch (_) {} }
          // remove controller for dead enemy
          try { controllers.delete(e) } catch (_) {}
          world.enemies[idx] = world.enemies[world.enemies.length - 1]
          world.enemies.pop()
          // spawn coin on death
          const coins = (Math.random() < 0.8) ? 1 : 0
          for (let ci = 0; ci < coins; ci++) world.coins.push({ x: e.x, y: e.y, speed: 240 })
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
        misses += 1
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
    // Coin pickup scoring
    for (let i = 0; i < world.coins.length; i++) {
      const c = world.coins[i]
      if (Math.hypot(c.x - p.x, c.y - p.y) < 12) {
        score += 5
        if (score > highScore) { highScore = score; try { localStorage.setItem(config.scoring.highScoreKey, String(highScore)) } catch (_) {} }
        world.coins[i] = world.coins[world.coins.length - 1]
        world.coins.pop(); i--
      }
    }
    // Powerup pickup (star): grant temporary bonus (increase spray count + spread)
    for (let i = 0; i < world.powerups.length; i++) {
      const u = world.powerups[i]
      if (Math.hypot(u.x - p.x, u.y - p.y) < 14) {
        config.player.spray.count = Math.min(20, (config.player.spray.count|0) + 2)
        config.player.spray.spreadDeg = Math.min(60, (config.player.spray.spreadDeg||0) + 6)
        world.powerups[i] = world.powerups[world.powerups.length - 1]
        world.powerups.pop(); i--
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
    let ox = 0, oy = 0
    // apply local FX offsets (windup/shake) for a brief time
    const nowMs = performance.now()
    if (e.fxWindupEndMs && nowMs < e.fxWindupEndMs) {
      // move backward along facing (we render triangle pointing up, so back is down in our coord)
      oy -= (e.fxWindupBackPx || 0)
    } else if (e.fxShakeEndMs && nowMs < e.fxShakeEndMs) {
      ox += ((Math.random() * 2 - 1) * (e.fxShakePx || 0))
      oy += ((Math.random() * 2 - 1) * (e.fxShakePx || 0))
    }
    pushInstance(e.x + ox, e.y + oy, 18, 22, Math.PI, 1.0, 0.3, 0.3)
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
  // Coins (gold)
  for (let i = 0; i < world.coins.length; i++) {
    const c = world.coins[i]
    pushInstance(c.x, c.y, 8, 8, 0, 1.0, 0.84, 0.2)
  }
  // Powerups (purple star proxy as larger diamond)
  for (let i = 0; i < world.powerups.length; i++) {
    const u = world.powerups[i]
    pushInstance(u.x, u.y, 14, 14, Math.PI / 4, 0.7, 0.4, 1.0)
  }
  renderer.setInstances(flat, flatCount)
  renderer.draw()

  // Boss HP bar update
  let boss = null
  for (let i = 0; i < world.enemies.length; i++) {
    const ee = world.enemies[i]
    const id = ee._enemyId
    if (id && enemyArchetypes[id]?.boss) { boss = ee; break }
  }
  if (boss && boss._maxHp > 0) {
    bossBarWrap.style.display = 'block'
    const ratio = Math.max(0, Math.min(1, boss.hp / boss._maxHp))
    bossBarFill.style.width = String(Math.floor(ratio * 100)) + '%'
  } else {
    bossBarWrap.style.display = 'none'
  }

  // Level complete overlay when runner done and no boss alive
  if (runner.done && !boss) {
    if (completeEl.style.display !== 'block') {
      completeMsg.textContent = `LEVEL COMPLETE\n\nscore ${formatScore(score)}\nhi ${formatScore(highScore)}\ncombo_peak ${formatScore(comboPeak)}\nmisses ${formatScore(misses)}`
      completeEl.style.display = 'block'
    }
  } else {
    completeEl.style.display = 'none'
  }

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

// Debug hooks for tests
window.__debug = window.__debug || {}
window.__debug.enemiesSummary = () => ({
  count: world.enemies.length,
  types: world.enemies.reduce((m, e) => { const k = e._enemyId || 'unknown'; m[k] = (m[k]||0)+1; return m }, {})
})
window.__debug.bulletsSummary = () => ({ player: world.playerBullets.length, enemy: world.enemyBullets.length })
window.__debug.frameCount = 0
const _origRender = render
// Wrap scheduler to increment frame counter
// (already scheduled via requestAnimationFrame when vsync=true)
// We avoid recursion; counter increments inside render below

// Debug: boss helpers
window.__debug.getBossInfo = () => {
  for (let i = 0; i < world.enemies.length; i++) {
    const ee = world.enemies[i]
    const id = ee._enemyId
    if (id && enemyArchetypes[id]?.boss) {
      return { id, hp: ee.hp, maxHp: ee._maxHp || ee.hp }
    }
  }
  return null
}
window.__debug.damageBoss = (amount = 10) => {
  for (let i = 0; i < world.enemies.length; i++) {
    const ee = world.enemies[i]
    const id = ee._enemyId
    if (id && enemyArchetypes[id]?.boss) {
      ee.hp -= amount
      if (ee.hp <= 0) {
        // remove immediately
        try { controllers.delete(ee) } catch (_) {}
        world.enemies[i] = world.enemies[world.enemies.length - 1]
        world.enemies.pop()
      }
      return true
    }
  }
  return false
}

window.__debug.forceSpawnGate = () => {
  // Spawn current stage gate enemy (miniboss or boss)
  const stage = levels[0].stages[runner.stageIndex]
  const gateId = (stage.miniboss && stage.miniboss.id) || (stage.boss && stage.boss.id)
  if (gateId) {
    spawnEnemyById(gateId, 'topRandom', createRng(deriveSeed(levels[0].seed, 'forceGate')))
    // Inform runner that gate has been spawned so it can complete when dead
    try { runner.stageGateSpawned = true } catch (_) {}
    return true
  }
  return false
}

window.__debug.setStage = (idx) => {
  if (typeof idx !== 'number') return false
  const max = levels[0].stages.length - 1
  const clamped = Math.max(0, Math.min(max, idx))
  runner.stageIndex = clamped
  runner._initStage && runner._initStage()
  return true
}



