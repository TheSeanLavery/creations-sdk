import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'

// Configure viewport for device-like behavior
uiDesign.setupViewport()
deviceControls.init()

const canvas = document.getElementById('glcanvas')
/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext('webgl2', { antialias: true })
if (!gl) {
  console.error('WebGL2 not supported')
}

// Minimal mat4 utilities
const Mat4 = {
  identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ])
  },
  multiply(a, b) {
    const out = new Float32Array(16)
    for (let i = 0; i < 4; i++) {
      const ai0 = a[i];
      const ai1 = a[i + 4];
      const ai2 = a[i + 8];
      const ai3 = a[i + 12];
      out[i]      = ai0 * b[0]  + ai1 * b[1]  + ai2 * b[2]  + ai3 * b[3]
      out[i + 4]  = ai0 * b[4]  + ai1 * b[5]  + ai2 * b[6]  + ai3 * b[7]
      out[i + 8]  = ai0 * b[8]  + ai1 * b[9]  + ai2 * b[10] + ai3 * b[11]
      out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15]
    }
    return out
  },
  perspective(fovyRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovyRad / 2)
    const nf = 1 / (near - far)
    const out = new Float32Array(16)
    out[0] = f / aspect
    out[1] = 0
    out[2] = 0
    out[3] = 0
    out[4] = 0
    out[5] = f
    out[6] = 0
    out[7] = 0
    out[8] = 0
    out[9] = 0
    out[10] = (far + near) * nf
    out[11] = -1
    out[12] = 0
    out[13] = 0
    out[14] = (2 * far * near) * nf
    out[15] = 0
    return out
  },
  translate(m, v) {
    const [x, y, z] = v
    const out = m.slice(0)
    out[12] = m[0] * x + m[4] * y + m[8]  * z + m[12]
    out[13] = m[1] * x + m[5] * y + m[9]  * z + m[13]
    out[14] = m[2] * x + m[6] * y + m[10] * z + m[14]
    out[15] = m[3] * x + m[7] * y + m[11] * z + m[15]
    return out
  },
  rotateX(m, rad) {
    const s = Math.sin(rad), c = Math.cos(rad)
    const r = new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ])
    return Mat4.multiply(m, r)
  },
  rotateY(m, rad) {
    const s = Math.sin(rad), c = Math.cos(rad)
    const r = new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ])
    return Mat4.multiply(m, r)
  },
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

const vsSource = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_color;
uniform mat4 u_mvp;
out vec3 v_color;
void main(){
  v_color = a_color;
  gl_Position = u_mvp * vec4(a_position, 1.0);
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
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
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

const uMvp = gl.getUniformLocation(program, 'u_mvp')

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

function render(timeMs) {
  resize()
  const t = timeMs * 0.001

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const aspect = canvas.width / Math.max(1, canvas.height)
  let proj = Mat4.perspective(Math.PI / 3, aspect, 0.1, 100.0)
  let view = Mat4.identity()
  view = Mat4.translate(view, [0, 0, -4])
  let model = Mat4.identity()
  model = Mat4.rotateY(model, t)
  model = Mat4.rotateX(model, t * 0.7)

  const vp = Mat4.multiply(proj, view)
  const mvp = Mat4.multiply(vp, model)
  gl.uniformMatrix4fv(uMvp, false, mvp)

  gl.bindVertexArray(vao)
  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)

  requestAnimationFrame(render)
}

// Ensure canvas has CSS size for clientWidth/clientHeight
function ensureCanvasCssSize() {
  if (!canvas.style.width) canvas.style.width = '100vw'
  if (!canvas.style.height) canvas.style.height = '100vh'
  canvas.style.display = 'block'
}

ensureCanvasCssSize()
requestAnimationFrame(render)

// Optional: react to device side button to toggle rotation direction
let direction = 1
deviceControls.on('sideButton', () => {
  direction *= -1
})

