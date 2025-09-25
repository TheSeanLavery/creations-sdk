import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'

// Init utilities
uiDesign.setupViewport()
deviceControls.init()

const pad = document.getElementById('pad')

// Create a full-screen canvas inside the pad
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
pad?.appendChild(canvas)

// HUD to show fingertip size (CSS px)
const hud = document.createElement('div')
hud.id = 'hud'
hud.textContent = ''
pad?.appendChild(hud)

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1
  const w = pad?.clientWidth || window.innerWidth
  const h = pad?.clientHeight || window.innerHeight
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#FE5F00'
  ctx.lineWidth = 4
}

window.addEventListener('resize', resizeCanvas)
resizeCanvas()

// Drawing state
let isDrawing = false
let lastX = 0
let lastY = 0

function getRelativePos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function computeTipSize(width, height) {
  const w = width || 0
  const h = height || 0
  return Math.max(w, h)
}

function computeLineWidthFromTip(size) {
  // Map tip diameter in CSS px to stroke width
  // Tweakable: feel free to adjust the scale and limits
  return clamp(2 + size * 0.2, 2, 24)
}

function updateHudTip(size) {
  if (!hud) return
  if (size && size > 0) {
    hud.textContent = size.toFixed(1)
    hud.style.display = 'block'
  } else {
    hud.textContent = ''
    hud.style.display = 'none'
  }
}

function beginStroke(x, y, width = 4, height = 4) {
  isDrawing = true
  lastX = x
  lastY = y
  const tip = computeTipSize(width, height)
  ctx.lineWidth = computeLineWidthFromTip(tip)
}

function drawStroke(x, y) {
  if (!isDrawing) return
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(x, y)
  ctx.stroke()
  lastX = x
  lastY = y
}

function endStroke() {
  isDrawing = false
  updateHudTip(0)
}

// Logging utility from prompt
function show(e, note = '') {
  const pts = []
  if (e.width && e.height) {
    pts.push({
      type: e.pointerType || 'touch',
      width: e.width,
      height: e.height,
      pressure: e.pressure ?? 0
    })
  }
  if (e.touches && e.touches.length) {
    for (const t of e.touches) {
      const rx = t.radiusX ?? t.webkitRadiusX
      const ry = t.radiusY ?? t.webkitRadiusY
      if (rx && ry) {
        pts.push({
          type: 'touch',
          width: rx * 2,
          height: ry * 2,
          force: t.force ?? t.webkitForce ?? undefined
        })
      }
    }
  }
  if (pts.length) {
    const p = pts[0]
    const dpr = window.devicePixelRatio || 1
    console.log(`[${note}] size ≈ ${p.width.toFixed(1)}×${p.height.toFixed(1)} CSS px (${(p.width * dpr).toFixed(1)}×${(p.height * dpr).toFixed(1)} device px)`, p)
  }
}

// Pointer events (preferred)
pad?.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    const { x, y } = getRelativePos(e.clientX, e.clientY)
    beginStroke(x, y, e.width ?? 4, e.height ?? 4)
    const tip = computeTipSize(e.width, e.height)
    updateHudTip(tip)
    drawStroke(x, y)
    pad.setPointerCapture?.(e.pointerId)
    show(e, 'pointerdown')
  } else if (e.pointerType === 'mouse') {
    const { x, y } = getRelativePos(e.clientX, e.clientY)
    beginStroke(x, y)
    drawStroke(x, y)
  }
})

pad?.addEventListener('pointermove', (e) => {
  if (!isDrawing) return
  const { x, y } = getRelativePos(e.clientX, e.clientY)
  if (e.pointerType === 'touch') {
    const tip = computeTipSize(e.width, e.height)
    ctx.lineWidth = computeLineWidthFromTip(tip)
    updateHudTip(tip)
    show(e, 'pointermove')
  }
  drawStroke(x, y)
})

pad?.addEventListener('pointerup', () => endStroke())
pad?.addEventListener('pointercancel', () => endStroke())
pad?.addEventListener('pointerleave', () => endStroke())

// Touch fallback
pad?.addEventListener('touchstart', (e) => {
  const t = e.touches[0]
  if (!t) return
  const { x, y } = getRelativePos(t.clientX, t.clientY)
  const rx = t.radiusX ?? t.webkitRadiusX ?? 2
  const ry = t.radiusY ?? t.webkitRadiusY ?? 2
  const tip = computeTipSize(rx * 2, ry * 2)
  beginStroke(x, y, rx * 2, ry * 2)
  updateHudTip(tip)
  drawStroke(x, y)
  show(e, 'touchstart')
}, { passive: true })

pad?.addEventListener('touchmove', (e) => {
  const t = e.touches[0]
  if (!t) return
  const { x, y } = getRelativePos(t.clientX, t.clientY)
  const rx = t.radiusX ?? t.webkitRadiusX ?? 2
  const ry = t.radiusY ?? t.webkitRadiusY ?? 2
  const tip = computeTipSize(rx * 2, ry * 2)
  ctx.lineWidth = computeLineWidthFromTip(tip)
  updateHudTip(tip)
  drawStroke(x, y)
  show(e, 'touchmove')
}, { passive: true })

pad?.addEventListener('touchend', () => endStroke(), { passive: true })
pad?.addEventListener('touchcancel', () => endStroke(), { passive: true })

console.log('Drawing App Ready!')

