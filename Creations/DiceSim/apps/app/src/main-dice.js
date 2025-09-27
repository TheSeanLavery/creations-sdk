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

// --- Procedural dice mesh with carved pips (per-face displacement) ---
function generateDiceMesh(options = {}) {
  const faceHalf = 1; // base cube half-extent in model space before scaling
  const resolution = options.resolution || 20; // grid per face side
  const pipRadius = options.pipRadius || 0.18;
  const pipDepth = options.pipDepth || 0.25; // depth along inward normal (in model units)
  const pipSpread = options.pipSpread || 0.6; // distance of corner pips from center in uv
  const centerPip = [0, 0];
  const corners = [
    [-pipSpread, -pipSpread],
    [-pipSpread,  pipSpread],
    [ pipSpread, -pipSpread],
    [ pipSpread,  pipSpread],
  ];
  const mids = [ [-pipSpread, 0], [ pipSpread, 0] ];

  function pipsForValue(val) {
    switch (val) {
      case 1: return [centerPip];
      case 2: return [corners[0], corners[3]];
      case 3: return [corners[0], centerPip, corners[3]];
      case 4: return [corners[0], corners[1], corners[2], corners[3]];
      case 5: return [corners[0], corners[1], centerPip, corners[2], corners[3]];
      case 6: return [corners[0], corners[1], mids[0], mids[1], corners[2], corners[3]];
      default: return [];
    }
  }

  // Face definitions: normal and local axes u, v
  const faces = [
    { n: [ 1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], val: 1 }, // +X
    { n: [-1, 0, 0], u: [0, 0,  1], v: [0, 1, 0], val: 6 }, // -X
    { n: [ 0, 1, 0], u: [1, 0,  0], v: [0, 0, 1], val: 2 }, // +Y
    { n: [ 0,-1, 0], u: [1, 0,  0], v: [0, 0,-1], val: 5 }, // -Y
    { n: [ 0, 0, 1], u: [1, 0,  0], v: [0, 1, 0], val: 3 }, // +Z
    { n: [ 0, 0,-1], u: [-1,0,  0], v: [0, 1, 0], val: 4 }, // -Z
  ];

  const positions = [];
  const normals = [];
  const indices = [];
  let vertBase = 0;

  function addVec3(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
  function mulAdd(a, b, s, out) { out[0] += b[0] * s; out[1] += b[1] * s; out[2] += b[2] * s; }
  function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }

  for (let f = 0; f < faces.length; f++) {
    const face = faces[f];
    const n = face.n, u = face.u, v = face.v;
    const center = [n[0]*faceHalf, n[1]*faceHalf, n[2]*faceHalf];
    const pips = pipsForValue(face.val);
    // Generate grid vertices
    const grid = new Array((resolution+1)*(resolution+1));
    const faceIndexStart = indices.length;
    for (let iy = 0; iy <= resolution; iy++) {
      for (let ix = 0; ix <= resolution; ix++) {
        const s = (ix / resolution) * 2 - 1; // [-1,1]
        const t = (iy / resolution) * 2 - 1; // [-1,1]
        // Base position on face plane
        let px = center[0] + u[0]*s*faceHalf + v[0]*t*faceHalf;
        let py = center[1] + u[1]*s*faceHalf + v[1]*t*faceHalf;
        let pz = center[2] + u[2]*s*faceHalf + v[2]*t*faceHalf;
        // Compute indentation depth from nearest pip
        let depth = 0;
        let gradU = 0, gradV = 0;
        for (let k = 0; k < pips.length; k++) {
          const cx = pips[k][0];
          const cy = pips[k][1];
          const dx = s - cx;
          const dy = t - cy;
          const r = Math.hypot(dx, dy);
          const r0 = pipRadius;
          const r1 = pipRadius * 0.6; // inner core for deeper region
          let kOuter = 0;
          if (r < r0) {
            // Smooth well: 0 at edge -> 1 at center
            const x = Math.min(1, Math.max(0, (r0 - r) / (r0 - r1)));
            kOuter = x * x * (3 - 2 * x);
            const d = pipDepth * (0.3 + 0.7 * kOuter);
            if (d > depth) depth = d;
            // Approx gradient for normal tilt
            const gScale = (r > 1e-5) ? (-pipDepth * 0.8 * kOuter / r) : 0;
            gradU += dx * gScale;
            gradV += dy * gScale;
          }
        }
        // Apply indentation along inward normal (negative along n from face plane toward cube center)
        px -= n[0] * depth;
        py -= n[1] * depth;
        pz -= n[2] * depth;
        positions.push(px, py, pz);
        // Initial normal is face normal; will refine by accumulating face triangles later
        normals.push(n[0], n[1], n[2]);
        grid[iy*(resolution+1) + ix] = vertBase + iy*(resolution+1) + ix;
      }
    }
    // Build indices per quad
    for (let iy = 0; iy < resolution; iy++) {
      for (let ix = 0; ix < resolution; ix++) {
        const i0 = grid[iy*(resolution+1) + ix];
        const i1 = grid[iy*(resolution+1) + ix + 1];
        const i2 = grid[(iy+1)*(resolution+1) + ix + 1];
        const i3 = grid[(iy+1)*(resolution+1) + ix];
        indices.push(i0, i1, i2, i0, i2, i3);
      }
    }
    // Ensure outward winding: flip all tris on this face if needed
    if (indices.length > faceIndexStart) {
      // Sample first triangle normal
      const a = indices[faceIndexStart + 0], b = indices[faceIndexStart + 1], c = indices[faceIndexStart + 2];
      const ax = positions[3*a], ay = positions[3*a+1], az = positions[3*a+2];
      const bx = positions[3*b], by = positions[3*b+1], bz = positions[3*b+2];
      const cx = positions[3*c], cy = positions[3*c+1], cz = positions[3*c+2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const dot = nx * n[0] + ny * n[1] + nz * n[2];
      if (dot < 0) {
        for (let i = faceIndexStart; i < indices.length; i += 3) {
          const tmp = indices[i+1]; indices[i+1] = indices[i+2]; indices[i+2] = tmp;
        }
      }
    }
    vertBase += (resolution+1)*(resolution+1);
  }

  // Recompute vertex normals from faces (per-face only; no cross-face sharing)
  const acc = new Array(positions.length / 3).fill(0).map(() => [0,0,0]);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i+1], c = indices[i+2];
    const ax = positions[3*a], ay = positions[3*a+1], az = positions[3*a+2];
    const bx = positions[3*b], by = positions[3*b+1], bz = positions[3*b+2];
    const cx = positions[3*c], cy = positions[3*c+1], cz = positions[3*c+2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    // Outward normal is along face.n; ensure we accumulate outward
    acc[a][0] += nx; acc[a][1] += ny; acc[a][2] += nz;
    acc[b][0] += nx; acc[b][1] += ny; acc[b][2] += nz;
    acc[c][0] += nx; acc[c][1] += ny; acc[c][2] += nz;
  }
  const outNormals = new Float32Array(normals.length);
  for (let i = 0; i < acc.length; i++) {
    const n = norm3(acc[i]);
    outNormals[3*i] = n[0]; outNormals[3*i+1] = n[1]; outNormals[3*i+2] = n[2];
  }

  return {
    positions: new Float32Array(positions),
    normals: outNormals,
    indices: new Uint32Array(indices),
  };
}

const diceMesh = generateDiceMesh({ resolution: 20, pipRadius: 0.18, pipDepth: 0.28, pipSpread: 0.6 })

// --- Shaders ---
const diceVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
uniform mat4 u_mvp;
uniform mat4 u_model;
out vec3 v_nrm_world;
void main(){
  vec3 n = mat3(u_model) * a_normal;
  v_nrm_world = normalize(n);
  gl_Position = u_mvp * u_model * vec4(a_position, 1.0);
}`

const diceFS = `#version 300 es
precision highp float;
in vec3 v_nrm_world;
out vec4 outColor;
const vec3 LIGHT_DIR = normalize(vec3(0.6, 0.8, 0.4));
const vec3 BASE_COLOR = vec3(0.95);
void main(){
  float ndl = max(0.0, dot(normalize(v_nrm_world), LIGHT_DIR));
  vec3 color = BASE_COLOR * (0.25 + 0.75 * ndl);
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
gl.bufferData(gl.ARRAY_BUFFER, diceMesh.positions, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
const diceNrmBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, diceNrmBuf)
gl.bufferData(gl.ARRAY_BUFFER, diceMesh.normals, gl.STATIC_DRAW)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
const diceIdxBuf = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, diceIdxBuf)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, diceMesh.indices, gl.STATIC_DRAW)
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
  const size = 0.5 * 0.75 // 3/4 of previous size
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
    // No initial rotating force; start at rest
    body.angularVelocity.set(0, 0, 0)
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
const accelTilt = new Float32Array([0, -1, 0]) // last tilt vector (x,y,z) in [-1,1]
const lastTilt = new Float32Array([0, -1, 0])

function wakeAllDice() {
  for (let i = 0; i < diceList.length; i++) {
    try { diceList[i].body.wakeUp() } catch {}
  }
}

function maybeWakeOnTiltChange(tx, ty, tz) {
  const dx = tx - lastTilt[0]
  const dy = ty - lastTilt[1]
  const dz = tz - lastTilt[2]
  const diff = Math.hypot(dx, dy, dz)
  const mag = Math.hypot(tx, ty, tz)
  if (diff > 0.05 || mag > 0.2) {
    wakeAllDice()
  }
  lastTilt[0] = tx; lastTilt[1] = ty; lastTilt[2] = tz
}
function startAccelerometer(frequency = 60) {
  try {
    const acc = window?.creationSensors?.accelerometer
    if (acc && typeof acc.start === 'function') {
      acc.start((data) => {
        if (!data) return
        // Use tilt vector in [-1,1] for gravity direction; normalize then scale to 9.8
        const tx0 = (typeof data.tiltX === 'number') ? data.tiltX : (typeof data.x === 'number' ? data.x : 0)
        const ty0 = (typeof data.tiltY === 'number') ? data.tiltY : (typeof data.y === 'number' ? data.y : -1)
        const tz0 = (typeof data.tiltZ === 'number') ? data.tiltZ : (typeof data.z === 'number' ? data.z : 0)
        // Flip X/Y; keep Z as-is to fix front/back inversion
        const tx = -tx0, ty = -ty0, tz = tz0
        accelTilt[0] = tx
        accelTilt[1] = ty
        accelTilt[2] = tz
        const len = Math.hypot(tx, ty, tz)
        const scale = (len > 1e-3) ? (9.8 * gravityScale / len) : (9.8 * gravityScale)
        accelG[0] = tx * scale
        accelG[1] = ty * scale
        accelG[2] = tz * scale
        maybeWakeOnTiltChange(tx, ty, tz)
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

  panel.appendChild(title)
  panel.appendChild(vals)
  panel.appendChild(source)
  document.body.appendChild(panel)

  tiltUi = { panel, vals, source, xEl: panel.querySelector('#tilt-x'), yEl: panel.querySelector('#tilt-y'), zEl: panel.querySelector('#tilt-z') }
}
setupTiltOverlay()

// Try to auto-start accelerometer when available (works in emulator shim)
try {
  const acc = window?.creationSensors?.accelerometer
  if (acc) {
    if (typeof acc.isAvailable === 'function') {
      acc.isAvailable().then((ok) => { if (ok) startAccelerometer(60) }).catch(() => {})
    } else {
      startAccelerometer(60)
    }
  }
  // Retry for a short window in case emulator shim injects after our script runs
  let tries = 0
  const maxTries = 40 // ~12s at 300ms
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

function computeGravity() {
  // Prefer accelerometer tilt-derived gravity if available
  if (useAccel) return accelG
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
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, diceMat, { friction: 0.35, restitution: 0.05 }))

function addThinWall(center, halfExtents) {
  const shape = new CANNON.Box(new CANNON.Vec3(halfExtents[0], halfExtents[1], halfExtents[2]))
  const body = new CANNON.Body({ mass: 0, material: groundMat })
  body.addShape(shape)
  body.position.set(center[0], center[1], center[2])
  world.addBody(body)
}

// Build 6 thin box walls (thickness 0.02)
const T = 0.02
addThinWall([ BOX_HALF, 0, 0], [T, BOX_HALF, BOX_HALF])
addThinWall([-BOX_HALF, 0, 0], [T, BOX_HALF, BOX_HALF])
addThinWall([0,  BOX_HALF, 0], [BOX_HALF, T, BOX_HALF])
addThinWall([0, -BOX_HALF, 0], [BOX_HALF, T, BOX_HALF])
addThinWall([0, 0,  BOX_HALF], [BOX_HALF, BOX_HALF, T])
addThinWall([0, 0, -BOX_HALF], [BOX_HALF, BOX_HALF, T])

function stepPhysics(dt) {
  const g = computeGravity()
  // Clamp gravity to reasonable bounds to avoid numeric explosions
  const gx = Math.max(-30, Math.min(30, g[0]))
  const gy = Math.max(-30, Math.min(30, g[1]))
  const gz = Math.max(-30, Math.min(30, g[2]))
  // If gravity direction changes abruptly, wake bodies and damp angular spin to avoid gyro-induced torque feel
  const prevG = world.gravity
  const prevLen = Math.hypot(prevG.x, prevG.y, prevG.z) || 1
  const currLen = Math.hypot(gx, gy, gz) || 1
  const px = prevG.x / prevLen, py = prevG.y / prevLen, pz = prevG.z / prevLen
  const cx = gx / currLen, cy = gy / currLen, cz = gz / currLen
  const dot = Math.max(-1, Math.min(1, px * cx + py * cy + pz * cz))
  const angle = Math.acos(dot)
  world.gravity.set(gx, gy, gz)
  if (angle > 0.2) {
    for (let i = 0; i < diceList.length; i++) {
      const b = diceList[i].body
      try {
        b.wakeUp()
        // halve angular velocity to prevent sudden opposite spin sensation
        b.angularVelocity.set(b.angularVelocity.x * 0.5, b.angularVelocity.y * 0.5, b.angularVelocity.z * 0.5)
        // clear any accumulated torque
        b.torque.set(0, 0, 0)
      } catch {}
    }
  }
  // Use fixed time step for stability; wake bodies if gravity changes significantly
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
      tiltUi.source.textContent = 'source: gyro tilt'
      tiltUi.xEl.textContent = accelTilt[0].toFixed(2)
      tiltUi.yEl.textContent = accelTilt[1].toFixed(2)
      tiltUi.zEl.textContent = accelTilt[2].toFixed(2)
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
    gl.drawElements(gl.TRIANGLES, diceMesh.indices.length, gl.UNSIGNED_INT, 0)
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

// Hardware scroll wheel: up -> add, down -> remove
deviceControls.on('scrollWheel', ({ direction }) => {
  if (direction === 'up') {
    diceList.push(makeDie([ (Math.random()-0.5)*1.2, 1.2 + Math.random()*0.4, (Math.random()-0.5)*1.2 ]))
  } else {
    if (diceList.length > 0) {
      const d = diceList.pop()
      try { world.removeBody(d.body) } catch {}
    }
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


