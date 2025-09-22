import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'
import { identity, perspective, translate, rotateX, rotateY, multiply } from './lib/mat4.js'

// Configure viewport for device-like behavior
uiDesign.setupViewport()
deviceControls.init()

const canvas = document.getElementById('glcanvas')
/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext('webgl2', { antialias: true })
if (!gl) {
  console.error('WebGL2 not supported')
}

// Mat4 utilities now imported from './lib/mat4.js'

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

const vsSource = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_color;
layout(location=2) in vec3 a_offset; // per-instance world-space offset
uniform mat4 u_vp;     // view-projection
uniform mat4 u_model;  // model rotation only
out vec3 v_color;
void main(){
  v_color = a_color;
  vec3 rotated = (u_model * vec4(a_position, 1.0)).xyz;
  vec3 worldPos = rotated + a_offset;
  gl_Position = u_vp * vec4(worldPos, 1.0);
}`

const fsSource = `#version 300 es
precision highp float;
in vec3 v_color;
out vec4 outColor;
void main(){
  outColor = vec4(v_color, 1.0);
}`

const program = createProgram(gl, vsSource, fsSource)
gl.useProgram(program)

// Cube geometry (positions and colors per-face)
const positions = new Float32Array([
  // +X
  1, -1, -1,  1, 1, -1,  1, 1, 1,  1, -1, 1,
  // -X
  -1, -1, 1,  -1, 1, 1,  -1, 1, -1,  -1, -1, -1,
  // +Y
  -1, 1, -1,  1, 1, -1,  1, 1, 1,  -1, 1, 1,
  // -Y
  -1, -1, 1,  1, -1, 1,  1, -1, -1,  -1, -1, -1,
  // +Z
  -1, -1, 1,  -1, 1, 1,  1, 1, 1,  1, -1, 1,
  // -Z
  1, -1, -1,  1, 1, -1,  -1, 1, -1,  -1, -1, -1,
])

const colors = new Float32Array([
  // +X (red)
  1,0,0, 1,0,0, 1,0,0, 1,0,0,
  // -X (green)
  0,1,0, 0,1,0, 0,1,0, 0,1,0,
  // +Y (blue)
  0,0,1, 0,0,1, 0,0,1, 0,0,1,
  // -Y (yellow)
  1,1,0, 1,1,0, 1,1,0, 1,1,0,
  // +Z (magenta)
  1,0,1, 1,0,1, 1,0,1, 1,0,1,
  // -Z (cyan)
  0,1,1, 0,1,1, 0,1,1, 0,1,1,
])

const indices = new Uint16Array([
  0,1,2,  0,2,3,
  4,5,6,  4,6,7,
  8,9,10, 8,10,11,
  12,13,14, 12,14,15,
  16,17,18, 16,18,19,
  20,21,22, 20,22,23,
])

const vao = gl.createVertexArray()
gl.bindVertexArray(vao)

const posBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)

const colBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, colBuf)
gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)

const idxBuf = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

const uVp = gl.getUniformLocation(program, 'u_vp')
const uModel = gl.getUniformLocation(program, 'u_model')

gl.enable(gl.DEPTH_TEST)
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
// VSync toggle (default off). Must be initialized before first scheduleNext() call
let useVsync = false

// Instancing data with object pool
let poolCapacity = 256
let activeCount = 0
const instanceBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
gl.bufferData(gl.ARRAY_BUFFER, poolCapacity * 3 * 4, gl.DYNAMIC_DRAW)
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0)
gl.vertexAttribDivisor(2, 1)

let instanceOffsetsData = new Float32Array(poolCapacity * 3)

function poolEnsureCapacity(minCount) {
  if (minCount <= poolCapacity) return
  let newCapacity = poolCapacity
  while (newCapacity < minCount) newCapacity *= 2
  const newData = new Float32Array(newCapacity * 3)
  newData.set(instanceOffsetsData.subarray(0, activeCount * 3))
  instanceOffsetsData = newData
  poolCapacity = newCapacity
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
  gl.bufferData(gl.ARRAY_BUFFER, poolCapacity * 3 * 4, gl.DYNAMIC_DRAW)
  if (activeCount > 0) {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceOffsetsData.subarray(0, activeCount * 3))
  }
}

function addCube(offset) {
  poolEnsureCapacity(activeCount + 1)
  const base = activeCount * 3
  instanceOffsetsData[base] = offset[0]
  instanceOffsetsData[base + 1] = offset[1]
  instanceOffsetsData[base + 2] = offset[2]
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
  gl.bufferSubData(gl.ARRAY_BUFFER, base * 4, instanceOffsetsData.subarray(base, base + 3))
  activeCount++
}

function removeCube() {
  if (activeCount <= 0) return
  activeCount--
  // No need to clear GPU; draw count decreases
}

// Camera distance (fixed)
let cameraDistance = 4

// Hemisphere spawn at fixed radius from camera
const SPAWN_RADIUS = 50
let spawnIndex = 0
function halton(index, base) {
  let f = 1
  let r = 0
  let i = index
  while (i > 0) {
    f /= base
    r += f * (i % base)
    i = Math.floor(i / base)
  }
  return r
}
function nextSphereOffsetFromCamera() {
  const i = ++spawnIndex
  const u = halton(i, 2)      // [0,1)
  const v = halton(i, 3)      // [0,1)
  // Uniform hemisphere in front of camera (looking -Z): z in [-1, 0)
  const z = -u
  const phi = 2 * Math.PI * v
  const rxy = Math.sqrt(Math.max(0, 1 - z * z))
  const dx = rxy * Math.cos(phi)
  const dy = rxy * Math.sin(phi)
  const dz = z
  const x = dx * SPAWN_RADIUS
  const y = dy * SPAWN_RADIUS
  const zWorld = cameraDistance + dz * SPAWN_RADIUS
  return [x, y, zWorld]
}

// Scroll momentum and ramp
let lastScrollTimeMs = 0
let lastScrollDir = 0 // +1 up, -1 down
let perScrollCount = 1
const rampWindowMs = 2000
let velocity = 0 // cubes per second; + adds, - removes
const decayRate = 0.4 // s^-1 exponential decay
let pendingAccumulator = 0

deviceControls.on('scrollWheel', ({ direction, event }) => {
  const now = performance.now()
  const dir = direction === 'up' ? 1 : -1
  if (dir === lastScrollDir && (now - lastScrollTimeMs) < rampWindowMs) {
    perScrollCount += 1
  } else {
    perScrollCount = 1
  }
  lastScrollTimeMs = now
  lastScrollDir = dir
  velocity += dir * perScrollCount
})

// seed a few cubes
for (let i = 0; i < 10; i++) addCube(nextSphereOffsetFromCamera())

function render(timeMs) {
  resize()
  const t = timeMs * 0.001
  // FPS tracking
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
    const fpsSamples = fpsDurationsMs.map(d => 1000 / Math.max(0.0001, d)).sort((a, b) => a - b)
    const idx = Math.max(0, Math.floor(0.01 * n))
    const low1 = fpsSamples[idx]
    fpsEl.textContent = `fps ${avgFps.toFixed(1)} | 1% ${low1.toFixed(1)} | cubes ${activeCount} | vsync ${useVsync ? 'on' : 'off'}`
  }
  // Update momentum-based add/remove
  const dt = Math.max(0, Math.min(0.1, frameDtMs * 0.001))
  // Exponential decay towards 0
  const decay = Math.exp(-decayRate * dt)
  velocity *= decay
  // Integrate pending work
  pendingAccumulator += velocity * dt
  let toProcess = 0
  if (pendingAccumulator >= 1) {
    toProcess = Math.floor(pendingAccumulator)
    pendingAccumulator -= toProcess
  } else if (pendingAccumulator <= -1) {
    toProcess = Math.ceil(pendingAccumulator)
    pendingAccumulator -= toProcess
  }
  if (toProcess > 0) {
    for (let i = 0; i < toProcess; i++) addCube(nextSphereOffsetFromCamera())
  } else if (toProcess < 0) {
    for (let i = 0; i < -toProcess; i++) removeCube()
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const aspect = canvas.width / Math.max(1, canvas.height)
  // Compute VP and model on worker if available, with fallback to main thread
  if (workerReady && !awaitingWorker) {
    awaitingWorker = true
    // Send compute job; worker will reply with vp/model
    worker.postMessage({ type: 'compute', timeSec: t * direction, aspect, cameraDistance })
  }
  if (latestVp && latestModel) {
    gl.uniformMatrix4fv(uVp, false, latestVp)
    gl.uniformMatrix4fv(uModel, false, latestModel)
  } else {
    // Fallback compute on main thread for first frame(s)
    const proj = perspective(Math.PI / 3, aspect, 0.1, 100.0)
    let view = identity()
    view = translate(view, [0, 0, -cameraDistance])
    let model = identity()
    model = rotateY(model, t * direction)
    model = rotateX(model, t * 0.7 * direction)
    const vp = multiply(proj, view)
    gl.uniformMatrix4fv(uVp, false, vp)
    gl.uniformMatrix4fv(uModel, false, model)
  }

  // Request vertex transform update in parallel to MVP computation
  if (workerReady) {
    maybeRequestTransform(t * direction)
  }

  gl.bindVertexArray(vao)
  gl.drawElementsInstanced(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0, Math.max(1, activeCount))

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
  if (useVsync) {
    requestAnimationFrame(render)
  } else {
    setTimeout(() => render(performance.now()), 0)
  }
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'v' || e.key === 'V') useVsync = !useVsync
})

// Optional: react to device side button to toggle rotation direction
let direction = 1
deviceControls.on('sideButton', () => {
  direction *= -1
})

// Worker setup
let worker
let workerReady = false
let awaitingWorker = false
let latestVp = null
let latestModel = null
let awaitingTransform = false

function initGeometryOnWorker() {
  try {
    const buffer = positions.buffer.slice(0)
    worker.postMessage({ type: 'initGeometry', buffer, length: positions.length }, [buffer])
  } catch (e) {
    // ignore
  }
}

function setupWorker() {
  try {
    // Vite supports new URL("./worker.js", import.meta.url) for workers
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (event) => {
      const data = event.data
      if (!data) return
      if (data.type === 'result') {
        const { vp, model } = data
        if (vp && vp.buffer) {
          latestVp = new Float32Array(vp.buffer, vp.byteOffset || 0, (vp.byteLength || (16 * 4)) / 4)
        }
        if (model && model.buffer) {
          latestModel = new Float32Array(model.buffer, model.byteOffset || 0, (model.byteLength || (16 * 4)) / 4)
        }
        awaitingWorker = false
        workerReady = true
      } else if (data.type === 'initAck') {
        workerReady = true
      } else if (data.type === 'transformResult') {
        const { buffer, byteOffset = 0, byteLength } = data.positions || {}
        if (buffer && byteLength === positions.byteLength) {
          const transformed = new Float32Array(buffer, byteOffset, positions.length)
          gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, transformed)
        }
        awaitingTransform = false
      }
    }
    worker.onerror = () => {
      workerReady = false
    }
  } catch (e) {
    workerReady = false
  }
}

setupWorker()
initGeometryOnWorker()

// Kick off per-frame transforms in tandem with MVP if worker is ready
function maybeRequestTransform(timeSec) {
  if (!workerReady || awaitingTransform) return
  awaitingTransform = true
  worker.postMessage({ type: 'transform', timeSec })
}

