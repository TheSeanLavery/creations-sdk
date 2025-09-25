import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'

// Configure viewport and controls
uiDesign.setupViewport()
deviceControls.init()

const canvas = document.getElementById('glcanvas')
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d')

// Game constants
const BLOCK_HEIGHT = 24
const MARGIN = 12
const BASE_WIDTH_FRAC = 0.6 // base block is 60% of play width
const INITIAL_SPEED = 120 // px/s
const SPEED_INCREMENT = 18 // per level

// Game state
let level = 1
let speedPxPerSec = INITIAL_SPEED
let playLeft = 0
let playRight = 0
let playBottomY = 0
let topThreshold = 0
let gameOver = false
let score = 0
let highScore = Number.parseInt(localStorage.getItem('stackerHighScore') || '0', 10) || 0

/**
 * Placed blocks, from bottom to top.
 * Each block: { x, y, width, height }
 */
let stack = []

/**
 * The moving block that the player will place.
 * { x, y, width, height, dir } where dir is +1 to the right or -1 to the left.
 */
let moving = null

// --- Audio (created on first user interaction) ---
let audioCtx = null
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (AC) {
      try { audioCtx = new AC() } catch (e) { audioCtx = null }
    }
  }
}
function beep(freq = 440, duration = 0.08, type = 'sine', gainAmt = 0.08) {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.value = 0
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  const now = audioCtx.currentTime
  gain.gain.linearRampToValueAtTime(gainAmt, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.start(now)
  osc.stop(now + duration + 0.02)
}
function sfxPlace(perfect) { beep(perfect ? 880 : 660, perfect ? 0.07 : 0.06, 'square', perfect ? 0.06 : 0.05) }
function sfxTrim() { beep(520, 0.05, 'triangle', 0.05) }
function sfxLevelUp() { beep(990, 0.1, 'sine', 0.07) }
function sfxGameOver() { beep(220, 0.25, 'sawtooth', 0.08) }

// Resize handling with DPR
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const displayWidth = Math.floor(canvas.clientWidth * dpr)
  const displayHeight = Math.floor(canvas.clientHeight * dpr)
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth
    canvas.height = displayHeight
  }
  playLeft = MARGIN
  playRight = canvas.width - MARGIN
  playBottomY = canvas.height - MARGIN - BLOCK_HEIGHT
  topThreshold = MARGIN * 2
}

function ensureCanvasCssSize() {
  if (!canvas.style.width) canvas.style.width = '100vw'
  if (!canvas.style.height) canvas.style.height = '100vh'
  canvas.style.display = 'block'
}

ensureCanvasCssSize()
resize()
window.addEventListener('resize', () => {
  // Simplest: reset board on resize to avoid geometry drift
  resize()
  startLevel(level, true)
})

function startLevel(newLevel, keepSpeed) {
  level = newLevel
  if (!keepSpeed) speedPxPerSec = INITIAL_SPEED + (level - 1) * SPEED_INCREMENT
  stack = []
  gameOver = false
  // Base block centered at bottom
  const baseWidth = Math.floor((playRight - playLeft) * BASE_WIDTH_FRAC)
  const baseX = Math.floor((canvas.width - baseWidth) / 2)
  stack.push({ x: baseX, y: playBottomY, width: baseWidth, height: BLOCK_HEIGHT })
  // Moving block starts one row above base, same width
  moving = {
    x: playLeft,
    y: playBottomY - BLOCK_HEIGHT,
    width: baseWidth,
    height: BLOCK_HEIGHT,
    dir: 1
  }
}

function nextLevel() {
  startLevel(level + 1, false)
  sfxLevelUp()
}

function restartGame() {
  score = 0
  level = 1
  speedPxPerSec = INITIAL_SPEED
  startLevel(1, true)
  gameOver = false
}

function placeBlock() {
  if (gameOver) return
  if (!moving || stack.length === 0) return
  const prev = stack[stack.length - 1]
  const left = Math.max(moving.x, prev.x)
  const right = Math.min(moving.x + moving.width, prev.x + prev.width)
  const overlap = right - left
  if (overlap <= 0) {
    // Missed entirely: game over
    gameOver = true
    if (score > highScore) {
      highScore = score
      try { localStorage.setItem('stackerHighScore', String(highScore)) } catch (e) {}
    }
    sfxGameOver()
    return
  }
  // Place trimmed block at the overlap
  const newBlock = { x: Math.floor(left), y: moving.y, width: Math.floor(overlap), height: BLOCK_HEIGHT }
  stack.push(newBlock)
  // Score +1 per successful placement
  score += 1
  const wasTrimmed = newBlock.width < moving.width
  if (wasTrimmed) {
    sfxTrim()
  } else {
    sfxPlace(newBlock.width === moving.width)
  }
  // Prepare next moving block above (direction unchanged; only flips at edges)
  moving.width = newBlock.width
  moving.x = Math.max(playLeft, Math.min(newBlock.x, playRight - moving.width))
  moving.y -= BLOCK_HEIGHT
  // Reached the top? Advance to next level with slightly faster speed
  if (moving.y <= topThreshold) {
    speedPxPerSec += SPEED_INCREMENT
    nextLevel()
  }
}

function handlePress() {
  ensureAudio()
  if (gameOver) {
    restartGame()
  } else {
    placeBlock()
  }
}

// Input bindings: side button (space via keyboard fallback) and clicks/taps
deviceControls.on('sideButton', handlePress)
canvas.addEventListener('pointerdown', (e) => { if (e && e.preventDefault) e.preventDefault(); if (e && e.isPrimary === false) return; handlePress() }, { passive: false })

// Draw helpers
function clear() {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawBlock(b, color) {
  ctx.fillStyle = color
  ctx.fillRect(b.x, b.y, b.width, b.height)
}

function drawHud() {
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.textBaseline = 'top'
  ctx.font = `${Math.max(10, Math.floor(canvas.height * 0.04))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
  ctx.fillText(`Level ${level}`, MARGIN, MARGIN)
  ctx.textAlign = 'right'
  ctx.fillText(`Score ${score}`, canvas.width - MARGIN, MARGIN)
  ctx.textAlign = 'left'
  ctx.font = `${Math.max(9, Math.floor(canvas.height * 0.03))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
  ctx.fillStyle = 'rgba(200,200,200,0.9)'
  ctx.fillText(`Best ${highScore}`, MARGIN, MARGIN + Math.max(12, Math.floor(canvas.height * 0.05)))
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.max(14, Math.floor(canvas.height * 0.07))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
  ctx.fillText('Game Over', canvas.width / 2, canvas.height * 0.38)
  ctx.font = `${Math.max(10, Math.floor(canvas.height * 0.04))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
  ctx.fillText(`Score ${score}   Best ${highScore}`, canvas.width / 2, canvas.height * 0.5)
  ctx.font = `${Math.max(10, Math.floor(canvas.height * 0.035))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText('Press Space or Click to Restart', canvas.width / 2, canvas.height * 0.62)
}

// Game loop
let prevTs = performance.now()
function tick(ts) {
  const dt = Math.min(0.05, Math.max(0, (ts - prevTs) * 0.001))
  prevTs = ts
  // Update moving block position
  if (moving && !gameOver) {
    moving.x += moving.dir * speedPxPerSec * dt
    if (moving.x <= playLeft) {
      moving.x = playLeft
      moving.dir = 1
    } else if (moving.x + moving.width >= playRight) {
      moving.x = playRight - moving.width
      moving.dir = -1
    }
  }
  // Render
  clear()
  // Guide rails
  ctx.fillStyle = '#222'
  ctx.fillRect(playLeft - 2, MARGIN, 4, canvas.height - MARGIN * 2)
  ctx.fillRect(playRight - 2, MARGIN, 4, canvas.height - MARGIN * 2)
  // Draw placed stack
  for (let i = 0; i < stack.length; i++) {
    const c = i === 0 ? '#2e7d32' : '#1976d2'
    drawBlock(stack[i], c)
  }
  // Draw moving block
  if (moving) drawBlock(moving, '#ff7043')
  drawHud()
  if (gameOver) drawGameOver()
  requestAnimationFrame(tick)
}

// Start
startLevel(1, false)
requestAnimationFrame(tick)

