import uiDesign from './lib/ui-design.js'
import deviceControls from './lib/device-controls.js'
import { identity, perspective, translate, multiply } from './lib/mat4.js'
import * as CANNON from 'cannon-es'

uiDesign.setupViewport()
deviceControls.init({ keyboardFallback: true })

const canvas = document.getElementById('glcanvas')
/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext('webgl2', { antialias: true, alpha: true })
if (!gl) {
  console.error('WebGL2 not supported')
}

// --- Minimal quaternion utilities ---
function quatIdentity() { return new Float32Array([0, 0, 0, 1]) }
function quatNormalize(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l
  return q
}
function quatMul(a, b) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3]
  const bx = b[0], by = b[1], bz = b[2], bw = b[3]
  return new Float32Array([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ])
}
function quatFromAxisAngle(axis, rad) {
  const [x, y, z] = axis
  const s = Math.sin(rad * 0.5)
  return quatNormalize(new Float32Array([x * s, y * s, z * s, Math.cos(rad * 0.5)]))
}
function quatFromAngularVelocity(omega, dt) {
  const w = Math.hypot(omega[0], omega[1], omega[2])
  if (w < 1e-6) return quatIdentity()
  const axis = [omega[0] / w, omega[1] / w, omega[2] / w]
  const ang = w * dt
  return quatFromAxisAngle(axis, ang)
}
function mat4FromQuat(q) {
  const x = q[0], y = q[1], z = q[2], w = q[3]
  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2
  return new Float32Array([
    1 - (yy + zz), xy - wz,       xz + wy,       0,
    xy + wz,       1 - (xx + zz), yz - wx,       0,
    xz - wy,       yz + wx,       1 - (xx + yy), 0,
    0,             0,             0,             1,
  ])
}

// --- Resize / viewport ---
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const displayWidth = Math.floor(canvas.clientWidth * dpr) || window.innerWidth
  const displayHeight = Math.floor(canvas.clientHeight * dpr) || window.innerHeight
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

// --- Dice geometry (unit cube with face normals) ---
// Side length s; we scale in shader via model matrix. Normals per face.
const cubePositions = new Float32Array([
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
const cubeNormals = new Float32Array([
  // +X
  1,0,0, 1,0,0, 1,0,0, 1,0,0,
  // -X
  -1,0,0, -1,0,0, -1,0,0, -1,0,0,
  // +Y
  0,1,0, 0,1,0, 0,1,0, 0,1,0,
  // -Y
  0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
  // +Z
  0,0,1, 0,0,1, 0,0,1, 0,0,1,
  // -Z
  0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
])
const cubeIndices = new Uint16Array([
  0,1,2, 0,2,3,
  4,5,6, 4,6,7,
  8,9,10, 8,10,11,
  12,13,14, 12,14,15,
  16,17,18, 16,18,19,
  20,21,22, 20,22,23,
])

// --- Shaders ---
const diceVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
uniform mat4 u_mvp;
uniform mat4 u_model;
out vec3 v_pos_model;
out vec3 v_nrm_model;
void main(){
  v_pos_model = a_position;
  v_nrm_model = a_normal;
  gl_Position = u_mvp * u_model * vec4(a_position, 1.0);
}`

// Fragment shader simulates pip indentations using signed-distance discs per face.
// This creates convincing 3D-looking dents (lighting only), while keeping cube geometry simple.
const diceFS = `#version 300 es
precision highp float;
in vec3 v_pos_model;
in vec3 v_nrm_model;
out vec4 outColor;

const vec3 LIGHT_DIR = normalize(vec3(0.6, 0.8, 0.4));
const vec3 BASE_COLOR = vec3(0.95);

float sdCircle(vec2 p, float r){ return length(p) - r; }

float addPip(vec2 uv, vec2 c, float r, out vec2 grad){
  vec2 d = uv - c;
  float len = length(d);
  float k = smoothstep(0.25, -0.05, len - r);
  grad = (len > 1e-5) ? (d / len) * k : vec2(0.0);
  return k;
}

void main(){
  vec3 n = normalize(v_nrm_model);
  int faceId = 0; // +X
  vec2 uv;
  // Map model position to face-local uv in [-0.5,0.5]
  if (n.x>0.5) { faceId=0; uv = vec2(v_pos_model.z, -v_pos_model.y) * 0.5; }
  else if (n.x<-0.5) { faceId=1; uv = vec2(v_pos_model.z, v_pos_model.y) * 0.5; }
  else if (n.y>0.5) { faceId=2; uv = vec2(v_pos_model.x, v_pos_model.z) * 0.5; }
  else if (n.y<-0.5) { faceId=3; uv = vec2(v_pos_model.x, -v_pos_model.z) * 0.5; }
  else if (n.z>0.5) { faceId=4; uv = vec2(v_pos_model.x, v_pos_model.y) * 0.5; }
  else { faceId=5; uv = vec2(-v_pos_model.x, v_pos_model.y) * 0.5; }

  // Determine pip layout value for each face
  int val = 1;
  if (faceId==0) val=1;      // +X
  else if (faceId==1) val=6; // -X
  else if (faceId==2) val=2; // +Y
  else if (faceId==3) val=5; // -Y
  else if (faceId==4) val=3; // +Z
  else if (faceId==5) val=4; // -Z

  float r = 0.18; // pip radius in uv units
  float dent = 0.0;
  vec2 gradSum = vec2(0.0);
  vec2 g;

  // Place pips
  if (val==1) {
    dent += addPip(uv, vec2(0.0,0.0), r, g); gradSum += g;
  } else if (val==2) {
    dent += addPip(uv, vec2(-0.5,-0.5), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.5,0.5), r, g); gradSum += g;
  } else if (val==3) {
    dent += addPip(uv, vec2(-0.6,-0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.0,0.0), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.6,0.6), r, g); gradSum += g;
  } else if (val==4) {
    dent += addPip(uv, vec2(-0.6,-0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(-0.6,0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.6,-0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.6,0.6), r, g); gradSum += g;
  } else if (val==5) {
    dent += addPip(uv, vec2(-0.6,-0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(-0.6,0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.0,0.0), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.6,-0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.6,0.6), r, g); gradSum += g;
  } else if (val==6) {
    dent += addPip(uv, vec2(-0.6,-0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(-0.6,0.0), r, g); gradSum += g;
    dent += addPip(uv, vec2(-0.6,0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.6,-0.6), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.6,0.0), r, g); gradSum += g;
    dent += addPip(uv, vec2(0.6,0.6), r, g); gradSum += g;
  }

  // Approximate normal perturbation: bend toward inward (face) and radial gradient
  vec3 planeVec;
  if (faceId==0) planeVec = normalize(vec3(gradSum.y, -gradSum.x, gradSum.x));
  else if (faceId==1) planeVec = normalize(vec3(-gradSum.y, gradSum.x, gradSum.x));
  else if (faceId==2) planeVec = normalize(vec3(gradSum.x, gradSum.y, gradSum.y));
  else if (faceId==3) planeVec = normalize(vec3(gradSum.x, -gradSum.y, -gradSum.y));
  else if (faceId==4) planeVec = normalize(vec3(gradSum.x, gradSum.y, gradSum.x));
  else planeVec = normalize(vec3(-gradSum.x, gradSum.y, -gradSum.x));

  vec3 modN = normalize(n - 0.6 * planeVec - 0.4 * dent * n);
  float ndl = max(0.0, dot(modN, normalize(LIGHT_DIR)));
  vec3 color = BASE_COLOR * (0.25 + 0.75 * ndl);
  color *= mix(1.0, 0.35, clamp(dent * 5.0, 0.0, 1.0));
  outColor = vec4(color, 1.0);
}`

const lineVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
uniform mat4 u_vp;
void main(){ gl_Position = u_vp * vec4(a_position, 1.0); }`

const lineFS = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main(){ outColor = u_color; }`

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

// --- Dice pipeline ---
const diceProg = createProgram(gl, diceVS, diceFS)
const diceVAO = gl.createVertexArray()
gl.bindVertexArray(diceVAO)
const dicePosBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, dicePosBuf)
gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
const diceNrmBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, diceNrmBuf)
gl.bufferData(gl.ARRAY_BUFFER, cubeNormals, gl.STATIC_DRAW)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
const diceIdxBuf = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, diceIdxBuf)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW)
const u_mvp = gl.getUniformLocation(diceProg, 'u_mvp')
const u_model = gl.getUniformLocation(diceProg, 'u_model')

// --- Wireframe box ---
const boxProg = createProgram(gl, lineVS, lineFS)
const u_vp = gl.getUniformLocation(boxProg, 'u_vp')
const u_color = gl.getUniformLocation(boxProg, 'u_color')

function buildBoxLines(size) {
  const s = size
  const pts = []
  const corners = [
    [-s,-s,-s], [ s,-s,-s], [ s, s,-s], [-s, s,-s],
    [-s,-s, s], [ s,-s, s], [ s, s, s], [-s, s, s],
  ]
  const edges = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ]
  for (const [a,b] of edges) {
    pts.push(...corners[a], ...corners[b])
  }
  return new Float32Array(pts)
}
const BOX_HALF = 2.0
const boxLines = buildBoxLines(BOX_HALF)
const boxVAO = gl.createVertexArray()
gl.bindVertexArray(boxVAO)
const boxBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, boxBuf)
gl.bufferData(gl.ARRAY_BUFFER, boxLines, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)

// Debug: visualize colliders as short normal arrows from wall centers
const colliderVAO = gl.createVertexArray()
gl.bindVertexArray(colliderVAO)
const colliderBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, colliderBuf)
const wallCenters = [
  [ BOX_HALF, 0, 0,  -1, 0, 0], // +X wall, normal -X
  [-BOX_HALF, 0, 0,   1, 0, 0], // -X wall, normal +X
  [ 0, BOX_HALF, 0,   0,-1, 0], // +Y wall, normal -Y
  [ 0,-BOX_HALF, 0,   0, 1, 0], // -Y wall, normal +Y
  [ 0, 0, BOX_HALF,   0, 0,-1], // +Z wall, normal -Z
  [ 0, 0,-BOX_HALF,   0, 0, 1], // -Z wall, normal +Z
]
const arrowLen = 0.6
const collPts = []
for (const [cx, cy, cz, nx, ny, nz] of wallCenters) {
  collPts.push(cx, cy, cz)
  collPts.push(cx + nx * arrowLen, cy + ny * arrowLen, cz + nz * arrowLen)
}
const colliderLines = new Float32Array(collPts)
gl.bufferData(gl.ARRAY_BUFFER, colliderLines, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)

// --- Physics state ---
function makeDie(pos, opts = {}){
  const size = 0.5
  const shape = new CANNON.Box(new CANNON.Vec3(size, size, size))
  const body = new CANNON.Body({ mass: 1, shape, material: diceMat, angularDamping: 0.2, linearDamping: 0.05 })
  body.position.set(pos[0], pos[1], pos[2])
  if (opts.initialVelocity) {
    const v = opts.initialVelocity; body.velocity.set(v[0], v[1], v[2])
  } else {
    body.velocity.set((Math.random()-0.5)*0.5, (Math.random())*0.5, (Math.random()-0.5)*0.5)
  }
  if (opts.angularVelocity) {
    const w = opts.angularVelocity; body.angularVelocity.set(w[0], w[1], w[2])
  } else {
    body.angularVelocity.set(0.5*(Math.random()*2-1), 0.4*(Math.random()*2-1), 0.5*(Math.random()*2-1))
  }
  // Improve sleep behavior for stability
  body.allowSleep = true
  body.sleepSpeedLimit = 0.25
  body.sleepTimeLimit = 0.4
  world.addBody(body)
  return { size, body }
}
let diceList = []
let seededFirstDie = false
const gravityWorld = new Float32Array([0, -9.8, 0])
let gravityScale = 1.0

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// Compute OBB extent radius along world axis from orientation
function obbRadiusAlongAxis(halfSize, rotMat, axisIndex) {
  // rotMat is 4x4; take absolute values of axis row
  const r0 = Math.abs(rotMat[axisIndex]) * halfSize
  const r1 = Math.abs(rotMat[axisIndex + 4]) * halfSize
  const r2 = Math.abs(rotMat[axisIndex + 8]) * halfSize
  return r0 + r1 + r2
}

// --- Camera ---
let cameraDistance = 5.0

// --- Controls: device orientation (gyro) and desktop fallback ---
let tiltX = 0, tiltY = 0 // radians, desktop fallback
function setupDeviceOrientation() {
  function handler(ev) {
    // ev.beta [-180,180] front-back, ev.gamma [-90,90] left-right
    const beta = (ev.beta || 0) * Math.PI / 180
    const gamma = (ev.gamma || 0) * Math.PI / 180
    // Map to gravity direction in world (approx): forward is -Z, right is +X, up is +Y
    tiltX = clamp(beta, -Math.PI/2, Math.PI/2)
    tiltY = clamp(gamma, -Math.PI/2, Math.PI/2)
  }
  // iOS 13+ permission gate
  try {
    const anyDO = window.DeviceOrientationEvent
    if (anyDO && anyDO.requestPermission) {
      document.body.addEventListener('click', async () => {
        try { const p = await anyDO.requestPermission(); if (p==='granted') window.addEventListener('deviceorientation', handler) } catch {}
      }, { once: true })
    } else if (anyDO) {
      window.addEventListener('deviceorientation', handler)
    }
  } catch {}
  // Desktop fallback via mouse drag
  let dragging = false, px = 0, py = 0
  window.addEventListener('mousedown', (e)=>{ dragging=true; px=e.clientX; py=e.clientY })
  window.addEventListener('mousemove', (e)=>{
    if (!dragging) return
    const dx = (e.clientX - px) / window.innerWidth
    const dy = (e.clientY - py) / window.innerHeight
    px = e.clientX; py = e.clientY
    tiltY += dx * Math.PI
    tiltX += dy * Math.PI
    tiltX = clamp(tiltX, -Math.PI/2, Math.PI/2)
    tiltY = clamp(tiltY, -Math.PI/2, Math.PI/2)
  })
  window.addEventListener('mouseup', ()=> dragging=false)
}
setupDeviceOrientation()

// --- Accelerometer (Creations SDK / emulator shim) ---
let useAccel = false
const accelG = new Float32Array([0, -9.8, 0])
function startAccelerometer(frequency = 60) {
  try {
    const acc = window?.creationSensors?.accelerometer
    if (acc && typeof acc.start === 'function') {
      acc.start((data) => {
        if (!data) return
        const tx = (typeof data.tiltX === 'number') ? data.tiltX : (typeof data.x === 'number' ? data.x : 0)
        const ty = (typeof data.tiltY === 'number') ? data.tiltY : (typeof data.y === 'number' ? data.y : -1)
        const tz = (typeof data.tiltZ === 'number') ? data.tiltZ : (typeof data.z === 'number' ? data.z : 0)
        const scale = 9.8 * gravityScale
        accelG[0] = tx * scale
        accelG[1] = ty * scale
        accelG[2] = tz * scale
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
      acc.stop();
      useAccel = false
      return true
    }
  } catch {}
  return false
}

// --- Minimal overlay UI to enable accel and show tilt ---
let tiltUi = null
function setupTiltOverlay() {
  const panel = document.createElement('div')
  panel.style.position = 'fixed'
  panel.style.right = '8px'
  panel.style.top = '8px'
  panel.style.padding = '8px 10px'
  panel.style.background = 'rgba(0,0,0,0.5)'
  panel.style.border = '1px solid rgba(255,255,255,0.2)'
  panel.style.borderRadius = '6px'
  panel.style.color = '#fff'
  panel.style.fontFamily = 'system-ui, -apple-system, Roboto, sans-serif'
  panel.style.fontSize = '12px'
  panel.style.zIndex = '1001'

  const title = document.createElement('div')
  title.textContent = 'Tilt'
  title.style.fontWeight = '600'
  title.style.marginBottom = '6px'

  const vals = document.createElement('div')
  vals.innerHTML = 'x <span id="tilt-x">0.00</span> | y <span id="tilt-y">0.00</span> | z <span id="tilt-z">1.00</span>'
  vals.style.marginBottom = '6px'

  const source = document.createElement('div')
  source.id = 'tilt-source'
  source.textContent = 'source: fallback'
  source.style.opacity = '0.8'
  source.style.marginBottom = '6px'

  const btn = document.createElement('button')
  btn.id = 'accel-toggle'
  btn.textContent = 'Start Accelerometer'
  btn.style.padding = '4px 8px'
  btn.style.fontSize = '12px'
  btn.style.cursor = 'pointer'
  btn.style.background = '#1b6ef3'
  btn.style.color = '#fff'
  btn.style.border = 'none'
  btn.style.borderRadius = '4px'

  btn.addEventListener('click', async () => {
    if (!useAccel) {
      // Check availability if present
      try {
        const acc = window?.creationSensors?.accelerometer
        if (!acc) return
        if (typeof acc.isAvailable === 'function') {
          const ok = await acc.isAvailable()
          if (!ok) return
        }
      } catch {}
      const started = startAccelerometer(60)
      if (started) btn.textContent = 'Stop Accelerometer'
    } else {
      const stopped = stopAccelerometer()
      if (stopped) btn.textContent = 'Start Accelerometer'
    }
  })

  panel.appendChild(title)
  panel.appendChild(vals)
  panel.appendChild(source)
  panel.appendChild(btn)
  document.body.appendChild(panel)

  tiltUi = { panel, vals, source, btn, xEl: panel.querySelector('#tilt-x'), yEl: panel.querySelector('#tilt-y'), zEl: panel.querySelector('#tilt-z') }
}
setupTiltOverlay()

function computeGravity() {
  // Prefer accelerometer vector if available
  if (useAccel) {
    return accelG
  }
  // Fallback: Base gravity downwards Y, rotate by tilts to align with device
  const gx = Math.sin(tiltY)
  const gz = -Math.sin(tiltX)
  const gy = -Math.cos(tiltX) * Math.cos(tiltY)
  const g = new Float32Array([gx, gy, gz])
  const gLen = Math.hypot(g[0], g[1], g[2]) || 1
  g[0] /= gLen; g[1] /= gLen; g[2] /= gLen
  g[0] *= 9.8 * gravityScale; g[1] *= 9.8 * gravityScale; g[2] *= 9.8 * gravityScale
  return g
}

// --- Render loop ---
gl.enable(gl.DEPTH_TEST)
gl.clearColor(0.02, 0.02, 0.035, 1.0)
gl.enable(gl.BLEND)
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

let prevMs = performance.now()

// --- Cannon-es physics world ---
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) })
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.solver.iterations = 20
world.defaultContactMaterial.friction = 0.4
world.defaultContactMaterial.restitution = 0.25

// Static box walls (AABB of BOX_HALF)
const groundMat = new CANNON.Material('ground')
const diceMat = new CANNON.Material('dice')
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, diceMat, { friction: 0.6, restitution: 0.05 }))

function addWall(normal, center) {
  const shape = new CANNON.Plane()
  const body = new CANNON.Body({ mass: 0, material: groundMat })
  body.addShape(shape)
  // Rotate plane so its normal aligns with provided normal, then offset along normal
  const n = new CANNON.Vec3(normal[0], normal[1], normal[2])
  const z = new CANNON.Vec3(0, 0, 1)
  const q = new CANNON.Quaternion()
  // Normalize target normal
  const nLen = n.length()
  if (nLen > 1e-6) n.scale(1 / nLen, n)
  const dot = z.dot(n)
  const EPS = 1e-6
  if (dot > 1 - EPS) {
    // Aligned: identity rotation
    q.set(0, 0, 0, 1)
  } else if (dot < -1 + EPS) {
    // Opposite: 180 degrees around any axis orthogonal to z
    // Choose X axis unless target normal is colinear; fall back to Y
    const axis = Math.abs(z.x) < 0.9 ? new CANNON.Vec3(1, 0, 0) : new CANNON.Vec3(0, 1, 0)
    q.setFromAxisAngle(axis, Math.PI)
  } else {
    const axis = new CANNON.Vec3()
    z.cross(n, axis)
    const axisLen = axis.length()
    if (axisLen > EPS) axis.scale(1 / axisLen, axis)
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    q.setFromAxisAngle(axis, angle)
  }
  body.quaternion.copy(q)
  // Place plane so that "center" is a point on the plane (face center)
  body.position.set(center[0], center[1], center[2])
  world.addBody(body)
}

// Build 6 walls using current BOX_HALF
// IMPORTANT: normals must face inward and positions must be at face centers
addWall([-1, 0, 0],  [ BOX_HALF, 0, 0]) // +X wall, inward -X
addWall([ 1, 0, 0],  [-BOX_HALF, 0, 0]) // -X wall, inward +X
addWall([ 0,-1, 0],  [0,  BOX_HALF, 0]) // +Y wall, inward -Y
addWall([ 0, 1, 0],  [0, -BOX_HALF, 0]) // -Y wall, inward +Y
addWall([ 0, 0,-1],  [0, 0,  BOX_HALF]) // +Z wall, inward -Z
addWall([ 0, 0, 1],  [0, 0, -BOX_HALF]) // -Z wall, inward +Z

function stepPhysics(dt) {
  const g = computeGravity()
  // Clamp gravity to reasonable bounds to avoid numeric explosions
  const gx = Math.max(-30, Math.min(30, g[0]))
  const gy = Math.max(-30, Math.min(30, g[1]))
  const gz = Math.max(-30, Math.min(30, g[2]))
  world.gravity.set(gx, gy, gz)
  // Use fixed time step for stability
  const fixed = 1 / 60
  world.step(fixed, dt, 3)
}

function render(nowMs) {
  resize()
  const dt = Math.min(0.033, Math.max(0.001, (nowMs - prevMs) * 0.001))
  prevMs = nowMs
  if (!seededFirstDie) { diceList.push(makeDie([0, 1.2, 0], { initialVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] })); seededFirstDie = true }
  stepPhysics(dt)

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const aspect = canvas.width / Math.max(1, canvas.height)
  const proj = perspective(Math.PI / 3, aspect, 0.05, 100.0)
  let view = identity()
  view = translate(view, [0, 0, -cameraDistance])
  const vp = multiply(proj, view)

  // Update tilt UI
  if (tiltUi) {
    if (useAccel) {
      tiltUi.source.textContent = 'source: accelerometer'
      tiltUi.xEl.textContent = (accelG[0] / (9.8 * gravityScale)).toFixed(2)
      tiltUi.yEl.textContent = (accelG[1] / (9.8 * gravityScale)).toFixed(2)
      tiltUi.zEl.textContent = (accelG[2] / (9.8 * gravityScale)).toFixed(2)
    } else {
      tiltUi.source.textContent = 'source: fallback'
      tiltUi.xEl.textContent = Math.sin(tiltY).toFixed(2)
      tiltUi.yEl.textContent = (-Math.cos(tiltX) * Math.cos(tiltY)).toFixed(2)
      tiltUi.zEl.textContent = (-Math.sin(tiltX)).toFixed(2)
    }
  }

  // Draw box (wireframe)
  gl.useProgram(boxProg)
  gl.uniformMatrix4fv(u_vp, false, vp)
  gl.uniform4f(u_color, 1, 1, 1, 0.2)
  gl.bindVertexArray(boxVAO)
  gl.drawArrays(gl.LINES, 0, boxLines.length / 3)

  // Draw collider normals (yellow)
  gl.useProgram(boxProg)
  gl.uniformMatrix4fv(u_vp, false, vp)
  gl.uniform4f(u_color, 1, 1, 0, 0.7)
  gl.bindVertexArray(colliderVAO)
  gl.drawArrays(gl.LINES, 0, colliderLines.length / 3)

  // Draw dice
  gl.useProgram(diceProg)
  gl.uniformMatrix4fv(u_mvp, false, vp)
  gl.bindVertexArray(diceVAO)
  for (let i = 0; i < diceList.length; i++) {
    const dice = diceList[i]
    const b = dice.body
    const q = new Float32Array([b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w])
    const Rm = mat4FromQuat(q)
    const model = Rm.slice(0)
    const Sx = dice.size, Sy = dice.size, Sz = dice.size
    model[0] *= Sx; model[1] *= Sx; model[2] *= Sx
    model[4] *= Sy; model[5] *= Sy; model[6] *= Sy
    model[8] *= Sz; model[9] *= Sz; model[10]*= Sz
    model[12] = b.position.x
    model[13] = b.position.y
    model[14] = b.position.z
    gl.uniformMatrix4fv(u_model, false, model)
    gl.drawElements(gl.TRIANGLES, cubeIndices.length, gl.UNSIGNED_SHORT, 0)
  }

  requestAnimationFrame(render)
}

requestAnimationFrame(render)

// Controls: side button toggles spawn/remove
deviceControls.on('sideButton', () => {
  if (diceList.length < 8) {
    diceList.push(makeDie([ (Math.random()-0.5)*1.2, 1.2 + Math.random()*0.4, (Math.random()-0.5)*1.2 ]))
  } else {
    const d = diceList.pop()
    try { world.removeBody(d.body) } catch {}
  }
})

// Expose minimal debug API for tests
try {
  if (typeof window !== 'undefined') {
    window.__diceDebug = {
      getSpeeds: () => diceList.map(d => {
        const v = d.body.velocity; return Math.hypot(v.x, v.y, v.z)
      }),
      getAngularSpeeds: () => diceList.map(d => {
        const w = d.body.angularVelocity; return Math.hypot(w.x, w.y, w.z)
      }),
      getSleeping: () => diceList.map(d => d.body.sleepState === 2),
      getCount: () => diceList.length
    }
  }
} catch {}


