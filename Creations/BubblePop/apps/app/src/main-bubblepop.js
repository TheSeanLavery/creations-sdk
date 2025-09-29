import uiDesign from './lib/ui-design.js'
import { identity, perspective, translate, multiply } from './lib/mat4.js'

uiDesign.setupViewport()

const canvas = document.getElementById('glcanvas')
/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext('webgl2', { antialias: true, alpha: true })
if (!gl) {
  console.error('WebGL2 not supported')
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const displayWidth = Math.floor((canvas.clientWidth || window.innerWidth) * dpr)
  const displayHeight = Math.floor((canvas.clientHeight || window.innerHeight) * dpr)
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth
    canvas.height = displayHeight
  }
  gl.viewport(0, 0, canvas.width, canvas.height)
}
function ensureCanvasCssSize() {
  if (!canvas.style.width) canvas.style.width = '100vw'
  if (!canvas.style.height) canvas.style.height = '100vh'
  canvas.style.display = 'block'
}
ensureCanvasCssSize()

function createShader(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh) || 'shader error')
    gl.deleteShader(sh)
    return null
  }
  return sh
}
function createProgram(gl, vsSrc, fsSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc)
  const prog = gl.createProgram()
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog) || 'link error')
    gl.deleteProgram(prog)
    return null
  }
  return prog
}

// Generate a UV sphere (positions + normals)
function generateSphere(segments = 24, rings = 16, radius = 0.5) {
  const positions = []
  const normals = []
  const indices = []
  for (let y = 0; y <= rings; y++) {
    const v = y / rings
    const theta = v * Math.PI
    const sinT = Math.sin(theta)
    const cosT = Math.cos(theta)
    for (let x = 0; x <= segments; x++) {
      const u = x / segments
      const phi = u * Math.PI * 2
      const sinP = Math.sin(phi)
      const cosP = Math.cos(phi)
      const nx = cosP * sinT
      const ny = cosT
      const nz = sinP * sinT
      positions.push(nx * radius, ny * radius, nz * radius)
      normals.push(nx, ny, nz)
    }
  }
  const stride = segments + 1
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const i0 = y * stride + x
      const i1 = i0 + 1
      const i2 = i0 + stride
      const i3 = i2 + 1
      indices.push(i0, i2, i1, i1, i2, i3)
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  }
}

// Bubbles grid parameters
const GRID_COLS = 10
const GRID_ROWS = 10
const GRID_COUNT = GRID_COLS * GRID_ROWS // 100

// One draw call: render active grid and incoming grid using 200 instances
const TOTAL_INSTANCES = GRID_COUNT * 2

// Bitfield state for active grid (1 = popped)
const stateBits = new Uint32Array(4) // 128 bits capacity
function setBit(i, popped) {
  const w = i >>> 5
  const b = i & 31
  if (popped) stateBits[w] |= (1 >>> 0) << b
  else stateBits[w] &= ~((1 >>> 0) << b)
}
function getBit(i) {
  const w = i >>> 5
  const b = i & 31
  return ((stateBits[w] >>> b) & 1) !== 0
}
function clearAllBits() {
  stateBits[0] = 0; stateBits[1] = 0; stateBits[2] = 0; stateBits[3] = 0
}

// Audio pop (simple one-shot)
let audioCtx = null
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)() } catch {}
  }
}
function playPopSound() {
  if (!audioCtx) return
  const t0 = audioCtx.currentTime
  const o = audioCtx.createOscillator()
  const g = audioCtx.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(520, t0)
  o.frequency.exponentialRampToValueAtTime(120, t0 + 0.08)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12)
  o.connect(g).connect(audioCtx.destination)
  o.start(t0)
  o.stop(t0 + 0.14)
}

// Shaders: per-vertex lighting, translucent flattened dome with rim wrinkles
const vs = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;

uniform mat4 u_vp;
uniform vec2 u_gridOrigin;     // world-space origin of grid center
uniform vec2 u_cellSize;       // x,y cell spacing
uniform int u_gridCols;
uniform int u_gridRows;
uniform float u_bubbleRadius;
uniform float u_scrollT;       // 0..gridHeight, when >0 draw incoming grid
uniform vec3 u_lightDir;
uniform uvec4 u_state;         // 128 bits -> 4*32

out vec3 v_normal;
out float v_visible;
out float v_ndl;
out float v_edge;
out float v_popped;

// Read pop bit for instance index [0..99]
bool isPopped(uint idx) {
  uint word = idx >> 5u;
  uint bit = idx & 31u;
  uint mask = uint(1) << bit;
  if (word == 0u) return (u_state.x & mask) != 0u;
  if (word == 1u) return (u_state.y & mask) != 0u;
  if (word == 2u) return (u_state.z & mask) != 0u;
  return (u_state.w & mask) != 0u;
}

void main(){
  // Determine which grid: 0=active, 1=incoming
  int gridIdx = gl_InstanceID / ${GRID_COUNT};
  int localIdx = gl_InstanceID - gridIdx * ${GRID_COUNT};
  int col = int(mod(float(localIdx), float(u_gridCols)));
  int row = localIdx / u_gridCols;

  // Compute base position
  // Staggered hex packing: every other row is offset by half a cell in X
  float rowParity = mod(float(row), 2.0);
  float gx = (float(col) - float(u_gridCols-1) * 0.5) * u_cellSize.x + u_gridOrigin.x + rowParity * 0.5 * u_cellSize.x;
  float gy = (float(row) - float(u_gridRows-1) * 0.5) * u_cellSize.y + u_gridOrigin.y;

  float gridHeight = float(u_gridRows) * u_cellSize.y;
  float yOffset = 0.0;
  if (gridIdx == 0) {
    yOffset = -u_scrollT; // active grid moves down
  } else {
    yOffset = gridHeight - u_scrollT; // incoming grid from top
  }

  bool popped = (gridIdx == 0) ? isPopped(uint(localIdx)) : false;

  // Start from sphere but keep only front hemisphere and flatten depth (dome)
  vec3 pos = a_position;
  pos.z = max(0.0, pos.z);
  float flatten = 0.3; // 1.0 = sphere, smaller = flatter dome
  pos.z *= flatten;
  // Apply scale to normals for non-uniform scaling
  vec3 nrm = a_normal;
  nrm.z *= (1.0/flatten);
  nrm = normalize(nrm);
  // Full-surface wrinkles using spherical direction and multiple octaves
  vec3 sp = normalize(a_position * 2.0);
  float w = 0.0;
  w += sin(sp.x * 48.0) * 0.6;
  w += sin(sp.y * 44.0) * 0.6;
  w += sin(sp.z * 40.0) * 0.6;
  w += sin((sp.x + sp.y) * 36.0) * 0.4;
  w += sin((sp.y + sp.z) * 32.0) * 0.3;
  float wrinkle = 0.02 * w;
  pos += nrm * wrinkle;
  // Apply bubble radius with popped flattening
  float heightScale = popped ? 0.03 : 1.0;
  pos.xy *= u_bubbleRadius;
  pos.z  *= (u_bubbleRadius * heightScale);

  vec3 worldPos = vec3(gx, gy + yOffset, 0.0) + pos;
  gl_Position = u_vp * vec4(worldPos, 1.0);

  // Lighting
  vec3 N = normalize(nrm);
  vec3 L = normalize(-u_lightDir);
  v_ndl = max(0.0, dot(N, L));
  v_normal = N;
  v_visible = 1.0; // keep visible; popped handled via flatten/alpha
  // Edge factor (for slight alpha tweak in fragment)
  float rim = 1.0 - clamp(abs(nrm.z), 0.0, 1.0);
  v_edge = rim;
  v_popped = popped ? 1.0 : 0.0;
}
`

const fs = `#version 300 es
precision highp float;
in vec3 v_normal;
in float v_visible;
in float v_ndl;
in float v_edge;
in float v_popped;
out vec4 outColor;

void main(){
  if (v_visible <= 0.0) discard;
  // Simple plastic-like shading
  vec3 base = mix(vec3(0.78, 0.84, 0.90), vec3(0.85, 0.93, 0.98), 1.0 - step(0.5, v_popped));
  vec3 color = base * (0.25 + 0.75 * v_ndl);
  float alpha = mix(0.18, 0.62 + 0.18 * (1.0 - v_edge), 1.0 - step(0.5, v_popped));
  outColor = vec4(color, alpha);
}
`

const prog = createProgram(gl, vs, fs)
gl.useProgram(prog)

// Geometry buffers
const sphere = generateSphere(24, 16, 0.5)
const vao = gl.createVertexArray()
gl.bindVertexArray(vao)
const posBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
const nrmBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf)
gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
const idxBuf = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW)

// Uniforms
const u_vp = gl.getUniformLocation(prog, 'u_vp')
const u_gridOrigin = gl.getUniformLocation(prog, 'u_gridOrigin')
const u_cellSize = gl.getUniformLocation(prog, 'u_cellSize')
const u_gridCols = gl.getUniformLocation(prog, 'u_gridCols')
const u_gridRows = gl.getUniformLocation(prog, 'u_gridRows')
const u_bubbleRadius = gl.getUniformLocation(prog, 'u_bubbleRadius')
const u_scrollT = gl.getUniformLocation(prog, 'u_scrollT')
const u_lightDir = gl.getUniformLocation(prog, 'u_lightDir')
const u_state = gl.getUniformLocation(prog, 'u_state[0]')

// GL state
gl.enable(gl.DEPTH_TEST)
gl.clearColor(0.02, 0.02, 0.035, 1.0)
gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

// Layout and camera
let bubbleRadius = 0.75
let cellX = 1.2
let cellY = 1.2
let gridOriginX = 0
let gridOriginY = 0

// Scroll animation
let scrollT = 0 // world units (0..gridHeight)
let scrolling = false
const SCROLL_SPEED = 6.0 // units per second

// Popping state
clearAllBits()
let poppedCount = 0

// Pointer input for drag-to-pop
let dragging = false
function screenToWorld(x, y, vpInv) {
  const ndcX = (x / canvas.width) * 2 - 1
  const ndcY = 1 - (y / canvas.height) * 2
  // Assume world z=0 plane; invert projection*view of (x,y,z=0)
  // Since our view is just translate along -Z and z of bubbles≈0, we can map in screen space into grid in view plane.
  // We'll compute using viewport mapping directly.
  // Build a simple inverse for our ortho-ish placement by projecting corners.
  return { x: ndcX, y: ndcY }
}

function pointerToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  const x = (clientX - rect.left) * (canvas.width / rect.width)
  const y = (clientY - rect.top) * (canvas.height / rect.height)
  // Map to world using current VP inverse (approx using perspective with fixed camera)
  // Derive world space scale per pixel at z≈0
  const aspect = canvas.width / Math.max(1, canvas.height)
  const proj = perspective(Math.PI / 3, aspect, 0.05, 100.0)
  let view = identity()
  view = translate(view, [0, 0, -6.0])
  const vp = multiply(proj, view)
  // Invert vp (manual small inverse since we know structure)
  // For simplicity, infer world units per NDC on x/y at z=0 by sampling two points
  function ndcToWorld(nx, ny) {
    // Unproject at z=0 in view space: scale by tan(fov/2)
    const tanF = Math.tan(Math.PI / 3 / 2)
    const wx = nx * tanF * 6.0 * aspect // at z=0, distance ≈ cameraDist
    const wy = ny * tanF * 6.0
    return [wx, wy]
  }
  const ndcX = (x / canvas.width) * 2 - 1
  const ndcY = 1 - (y / canvas.height) * 2
  const w = ndcToWorld(ndcX, ndcY)
  const wx = w[0]
  const wy = w[1]
  // Apply scroll offsets: active grid shifted by -scrollT
  const gy = wy + scrollT - gridOriginY
  const gx = wx - gridOriginX
  // Estimate row first
  const row = Math.round(gy / cellY + (GRID_ROWS - 1) * 0.5)
  if (row < 0 || row >= GRID_ROWS) return -1
  // Apply row offset for hex packing
  const parity = row & 1
  const gxOffset = gx - (parity ? 0.5 * cellX : 0)
  const col = Math.round(gxOffset / cellX + (GRID_COLS - 1) * 0.5)
  if (col < 0 || col >= GRID_COLS) return -1
  return row * GRID_COLS + col
}

canvas.addEventListener('pointerdown', (e) => {
  dragging = true
  ensureAudio()
  const idx = pointerToCell(e.clientX, e.clientY)
  if (idx >= 0 && !getBit(idx)) {
    setBit(idx, true)
    poppedCount++
    playPopSound()
  }
})
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return
  const idx = pointerToCell(e.clientX, e.clientY)
  if (idx >= 0 && !getBit(idx)) {
    setBit(idx, true)
    poppedCount++
    playPopSound()
  }
})
canvas.addEventListener('pointerup', ()=> dragging = false)
canvas.addEventListener('pointercancel', ()=> dragging = false)

// Layout recompute based on canvas size
function updateLayout() {
  const aspect = canvas.width / Math.max(1, canvas.height)
  // Fit grid nicely in view at cameraDistance=6
  const cameraDistance = 6.0
  const fovy = Math.PI / 3
  const viewHeight = 2 * Math.tan(fovy / 2) * cameraDistance
  const viewWidth = viewHeight * aspect
  // Leave a small margin
  const margin = 0.4
  // For hex-like packing: horizontal spacing is tighter because alternate rows are offset by 0.5 cell
  // Effective width fits (cols - 0.5) cells across
  const usableW = viewWidth - margin * 2
  const usableH = viewHeight - margin * 2
  const cellW = usableW / (GRID_COLS - 0.5)
  // Hex packing vertical spacing = sqrt(3)/2 * cellX when using 0.5 horizontal offset
  const idealCellY = cellW * 0.8660254
  const maxCellY = usableH / (GRID_ROWS - 1.0) // allow last row to fit when offset
  const cell = Math.min(cellW, maxCellY)
  cellX = cell
  cellY = Math.min(idealCellY, maxCellY)
  // Set radius so neighboring bubbles just touch horizontally and vertically
  const horizRadius = 0.5 * cellX
  const vertRadius  = 0.5 * cellY
  bubbleRadius = Math.min(horizRadius, vertRadius)
  gridOriginX = 0
  gridOriginY = 0
}

let prevMs = performance.now()
// Gyro-driven light with auto recentring (dice-style auto start)
let lightDir = new Float32Array([0.3, 0.8, 0.5])
let targetLightDir = new Float32Array([0.3, 0.8, 0.5])
let baseLightDir = new Float32Array([0.3, 0.8, 0.5]) // default
let haveGyro = false
let useAccel = false

function startAccelerometer(frequency = 60) {
  try {
    const acc = window?.creationSensors?.accelerometer
    if (acc && typeof acc.start === 'function') {
      acc.start((data) => {
        if (!data) return
        const tx0 = (typeof data.tiltX === 'number') ? data.tiltX : (typeof data.x === 'number' ? data.x : 0)
        const ty0 = (typeof data.tiltY === 'number') ? data.tiltY : (typeof data.y === 'number' ? data.y : -1)
        const tz0 = (typeof data.tiltZ === 'number') ? data.tiltZ : (typeof data.z === 'number' ? data.z : 0)
        // Map tilt to light direction; flip Y/Z to align with scene up
        let lx = tx0
        let ly = -ty0 + 0.6
        let lz = -tz0 + 0.2
        const len = Math.hypot(lx, ly, lz) || 1
        lx /= len; ly /= len; lz /= len
        targetLightDir[0] = lx
        targetLightDir[1] = ly
        targetLightDir[2] = lz
        haveGyro = true
        useAccel = true
      }, { frequency })
      return true
    }
  } catch {}
  return false
}

function stopAccelerometer() {
  try {
    const acc = window?.creationSensors?.accelerometer
    if (acc && typeof acc.stop === 'function') {
      acc.stop()
      useAccel = false
      return true
    }
  } catch {}
  return false
}

// Auto-start (mirrors dice startup + retry)
try {
  const acc = window?.creationSensors?.accelerometer
  if (acc) {
    if (typeof acc.isAvailable === 'function') {
      acc.isAvailable().then((ok) => { if (ok) startAccelerometer(60) }).catch(() => {})
    } else {
      startAccelerometer(60)
    }
  }
  let tries = 0
  const maxTries = 40
  const t = setInterval(() => {
    if (useAccel) { clearInterval(t); return }
    try {
      const acc2 = window?.creationSensors?.accelerometer
      if (acc2) {
        if (typeof acc2.isAvailable === 'function') {
          acc2.isAvailable().then((ok) => { if (ok) startAccelerometer(60) }).catch(() => {})
        } else {
          startAccelerometer(60)
        }
      }
    } catch {}
    tries++
    if (tries >= maxTries) clearInterval(t)
  }, 300)
} catch {}
function render(nowMs) {
  resize()
  updateLayout()
  const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevMs) * 0.001))
  prevMs = nowMs

  // Scroll when all popped
  if (!scrolling && poppedCount >= GRID_COUNT) {
    scrolling = true
  }
  if (scrolling) {
    const gridHeight = GRID_ROWS * cellY
    scrollT += SCROLL_SPEED * dt
    if (scrollT >= gridHeight) {
      // Finish: reset
      scrollT = 0
      scrolling = false
      clearAllBits()
      poppedCount = 0
    }
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const aspect = canvas.width / Math.max(1, canvas.height)
  const proj = perspective(Math.PI / 3, aspect, 0.05, 100.0)
  let view = identity()
  view = translate(view, [0, 0, -6.0])
  const vp = multiply(proj, view)

  // Auto recenter light: always drift target towards base while following input
  const recenterRate = 0.35 // per second (drift towards base)
  const followRate = 7.0 // per second (follow input)
  let tx = haveGyro ? targetLightDir[0] : baseLightDir[0]
  let ty = haveGyro ? targetLightDir[1] : baseLightDir[1]
  let tz = haveGyro ? targetLightDir[2] : baseLightDir[2]
  // Drift target towards base
  tx += (baseLightDir[0] - tx) * Math.min(1, recenterRate * dt)
  ty += (baseLightDir[1] - ty) * Math.min(1, recenterRate * dt)
  tz += (baseLightDir[2] - tz) * Math.min(1, recenterRate * dt)
  // Follow the drifted target
  lightDir[0] += (tx - lightDir[0]) * Math.min(1, followRate * dt)
  lightDir[1] += (ty - lightDir[1]) * Math.min(1, followRate * dt)
  lightDir[2] += (tz - lightDir[2]) * Math.min(1, followRate * dt)
  const ll = Math.hypot(lightDir[0], lightDir[1], lightDir[2]) || 1
  lightDir[0] /= ll; lightDir[1] /= ll; lightDir[2] /= ll

  gl.useProgram(prog)
  gl.uniformMatrix4fv(u_vp, false, vp)
  gl.uniform2f(u_gridOrigin, gridOriginX, gridOriginY)
  gl.uniform2f(u_cellSize, cellX, cellY)
  gl.uniform1i(u_gridCols, GRID_COLS)
  gl.uniform1i(u_gridRows, GRID_ROWS)
  gl.uniform1f(u_bubbleRadius, bubbleRadius)
  gl.uniform1f(u_scrollT, scrollT)
  // Static light for now; gyro-controlled recentering to be added next
  // Light direction updated below via gyro smoothing
  gl.uniform3f(u_lightDir, lightDir[0], lightDir[1], lightDir[2])
  gl.uniform1uiv(u_state, stateBits)

  gl.bindVertexArray(vao)
  gl.drawElementsInstanced(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_INT, 0, TOTAL_INSTANCES)

  requestAnimationFrame(render)
}

requestAnimationFrame(render)


