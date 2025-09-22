import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'

// Configure viewport for device-like behavior
uiDesign.setupViewport()
deviceControls.init()

const canvas = document.getElementById('glcanvas')
/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext('webgl2', { antialias: false })
if (!gl) {
  console.error('WebGL2 not supported')
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader) || 'Shader compile error')
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program) || 'Program link error')
    gl.deleteProgram(program)
    return null
  }
  return program
}

// Fullscreen triangle (no VAO/attributes needed using gl_VertexID)
const vsSource = `#version 300 es
precision highp float;
void main(){
  // 3-vertex fullscreen triangle
  vec2 pos = vec2(
    (gl_VertexID == 0) ? -1.0 : (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 0) ? -1.0 : (gl_VertexID == 1) ? -1.0 : 3.0
  );
  gl_Position = vec4(pos, 0.0, 1.0);
}`

const fsSource = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 u_resolution;  // framebuffer size in pixels
uniform vec2 u_center;      // complex plane center (x,y)
uniform float u_scale;      // half-height in complex plane units
uniform int u_maxIter;      // iteration count

vec3 palette(float t){
  // IQ-like cosine palette
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return a + b * cos(6.28318 * (c * t + d));
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution; // [0,1]
  float aspect = u_resolution.x / max(1.0, u_resolution.y);
  float halfH = u_scale;
  float halfW = u_scale * aspect;
  vec2 minC = u_center + vec2(-halfW, -halfH);
  vec2 maxC = u_center + vec2( halfW,  halfH);
  vec2 c = mix(minC, maxC, uv);

  vec2 z = vec2(0.0);
  int i;
  for (i = 0; i < u_maxIter; i++) {
    // z = z^2 + c
    float x = z.x*z.x - z.y*z.y + c.x;
    float y = 2.0*z.x*z.y + c.y;
    z = vec2(x, y);
    if (dot(z, z) > 1024.0) break; // escape radius^2
  }

  if (i == u_maxIter) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // Smooth coloring
    float m2 = dot(z, z);
    float nu = log(log(max(1.000001, m2)) / 2.0) / log(2.0);
    float it = float(i) + 1.0 - nu;
    float t = it / float(u_maxIter);
    vec3 col = palette(t);
    outColor = vec4(col, 1.0);
  }
}`

const program = createProgram(gl, vsSource, fsSource)
gl.useProgram(program)

const uResolution = gl.getUniformLocation(program, 'u_resolution')
const uCenter = gl.getUniformLocation(program, 'u_center')
const uScale = gl.getUniformLocation(program, 'u_scale')
const uMaxIter = gl.getUniformLocation(program, 'u_maxIter')

gl.disable(gl.DEPTH_TEST)
gl.clearColor(0.03, 0.03, 0.05, 1.0)

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const displayWidth = Math.floor(canvas.clientWidth * dpr)
  const displayHeight = Math.floor(canvas.clientHeight * dpr)
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth
    canvas.height = displayHeight
  }
  gl.viewport(0, 0, canvas.width, canvas.height)
}

// Minimal FPS overlay
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
let useVsync = false

// Fractal state
let centerX = -0.75
let centerY = 0.0
let logScale = Math.log(1.5) // half-height in complex plane units

// Momentum wheel zoom (velocity on logScale)
let lastScrollTimeMs = 0
let lastScrollDir = 0 // +1 up, -1 down
let perScrollCount = 1
const rampWindowMs = 2000
let zoomVelocity = 0 // units per second applied to -logScale (zoom in on up)
const decayRate = 0.4 // s^-1 exponential decay

deviceControls.on('scrollWheel', ({ direction }) => {
  const now = performance.now()
  const dir = direction === 'up' ? 1 : -1
  if (dir === lastScrollDir && (now - lastScrollTimeMs) < rampWindowMs) perScrollCount += 1
  else perScrollCount = 1
  lastScrollTimeMs = now
  lastScrollDir = dir
  zoomVelocity += dir * perScrollCount
})

// Click/touch to recenter at pointer in complex plane
function setCenterFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const px = (clientX - rect.left) * dpr
  const py = (clientY - rect.top) * dpr
  const w = Math.max(1, canvas.width)
  const h = Math.max(1, canvas.height)
  const uvx = px / w
  const uvy = 1 - (py / h) // DOM y is top-down; GL is bottom-up
  const aspect = w / h
  const scale = Math.exp(logScale)
  const halfH = scale
  const halfW = scale * aspect
  const minX = centerX - halfW
  const maxX = centerX + halfW
  const minY = centerY - halfH
  const maxY = centerY + halfH
  const x = minX + (maxX - minX) * uvx
  const y = minY + (maxY - minY) * uvy
  centerX = x
  centerY = y
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  setCenterFromClient(e.clientX, e.clientY)
})
canvas.addEventListener('touchstart', (e) => {
  if (e.touches && e.touches.length > 0) {
    e.preventDefault()
    const t = e.touches[0]
    setCenterFromClient(t.clientX, t.clientY)
  }
}, { passive: false })

function render(timeMs) {
  resize()

  const frameDtMs = timeMs - renderPrevTimeMs
  renderPrevTimeMs = timeMs
  fpsDurationsMs.push(frameDtMs)
  fpsSumMs += frameDtMs
  while (fpsSumMs > fpsWindowMs && fpsDurationsMs.length > 0) {
    fpsSumMs -= fpsDurationsMs.shift()
  }
  if (fpsDurationsMs.length > 0) {
    const n = fpsDurationsMs.length
    const avgDt = fpsSumMs / n
    const avgFps = 1000 / Math.max(0.0001, avgDt)
    fpsEl.textContent = `fps ${avgFps.toFixed(1)} | zoom ${(-logScale).toFixed(2)}`
  }

  // Integrate zoom momentum on logScale (positive dir = zoom in)
  const dt = Math.max(0, Math.min(0.1, frameDtMs * 0.001))
  const decay = Math.exp(-decayRate * dt)
  zoomVelocity *= decay
  logScale -= zoomVelocity * dt
  // Clamp scale to reasonable bounds
  const minScale = 1e-14
  const maxScale = 4.0
  const scale = Math.min(maxScale, Math.max(minScale, Math.exp(logScale)))
  logScale = Math.log(scale)

  gl.clear(gl.COLOR_BUFFER_BIT)

  // Iterations scale up as we zoom in
  const zoomLevel = Math.max(0, -logScale)
  const maxIter = Math.min(4096, Math.floor(100.0 + 60.0 * zoomLevel))

  gl.useProgram(program)
  gl.uniform2f(uResolution, canvas.width, canvas.height)
  gl.uniform2f(uCenter, centerX, centerY)
  gl.uniform1f(uScale, scale)
  gl.uniform1i(uMaxIter, maxIter)

  gl.drawArrays(gl.TRIANGLES, 0, 3)

  scheduleNext()
}

function ensureCanvasCssSize() {
  if (!canvas.style.width) canvas.style.width = '100vw'
  if (!canvas.style.height) canvas.style.height = '100vh'
  canvas.style.display = 'block'
}

ensureCanvasCssSize()
scheduleNext()

function scheduleNext() {
  if (useVsync) requestAnimationFrame(render)
  else setTimeout(() => render(performance.now()), 0)
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'v' || e.key === 'V') useVsync = !useVsync
})


