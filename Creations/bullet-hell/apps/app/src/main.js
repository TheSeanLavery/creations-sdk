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
deviceControls.on('sideButton', () => { fireHeld = !fireHeld })

// Spawning
let enemySpawnTimer = 0
let enemyFireTimer = 0
let playerFireTimer = 0

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
  const moveSpeed = 180
  let mx = 0, my = 0
  if (keys.has('arrowleft') || keys.has('a')) mx -= 1
  if (keys.has('arrowright') || keys.has('d')) mx += 1
  if (keys.has('arrowup') || keys.has('w')) my -= 1
  if (keys.has('arrowdown') || keys.has('s')) my += 1
  if (mx !== 0 || my !== 0) {
    const mag = Math.hypot(mx, my) || 1
    p.x += (mx / mag) * moveSpeed * dt
    p.y += (my / mag) * moveSpeed * dt
  }
  clampPlayer(world)

  // Spawning
  enemySpawnTimer -= dt
  if (enemySpawnTimer <= 0) {
    const ex = (Math.random() * 2 - 1) * (world.width - 20)
    // Spawn at the top edge and move downward (negative vy)
    spawnEnemy(world, ex, world.height - 20, -(40 + Math.random() * 30))
    enemySpawnTimer = 0.75
  }
  enemyFireTimer -= dt
  if (enemyFireTimer <= 0 && world.enemies.length > 0) {
    const e = world.enemies[(Math.random() * world.enemies.length) | 0]
    const dx = p.x - e.x, dy = p.y - e.y
    fireEnemyBullet(world, e.x, e.y, dx, dy, 140 + Math.random() * 60)
    enemyFireTimer = 0.6
  }
  playerFireTimer -= dt
  if (fireHeld && playerFireTimer <= 0) {
    firePlayerBullet(world, p.x, p.y - 12, 0, -1, 260)
    playerFireTimer = 0.1
  }

  // Integrate
  updateWorld(world, dt)

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
      if (aabbIntersect(world.player.x, world.player.y, 1, 1, b.x, b.y, b.w, b.h)) {
        world.player.alive = false
        break
      }
    }
  }

  // Build instances and draw
  flatCount = 0
  renderer.beginFrame()
  // Player
  if (world.player.alive) pushInstance(p.x, p.y, 14, 18, 0, 0.2, 0.9, 1.0)
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


