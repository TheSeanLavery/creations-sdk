// Lightweight 2D WebGL2 instanced triangle renderer

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

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;            // base triangle vertex
layout(location=1) in vec2 a_i_position;     // instance world position (pixels, origin center)
layout(location=2) in vec2 a_i_scale;        // instance scale in pixels (width,height)
layout(location=3) in float a_i_rotation;    // instance rotation radians (0 up)
layout(location=4) in vec3 a_i_color;        // instance color
uniform vec2 u_halfViewSize;                 // half width/height in pixels
out vec3 v_color;
void main(){
  float s = sin(a_i_rotation);
  float c = cos(a_i_rotation);
  vec2 scaled = a_pos * a_i_scale;           // scale base triangle
  vec2 rotated = vec2(
    scaled.x * c - scaled.y * s,
    scaled.x * s + scaled.y * c
  );
  vec2 world = a_i_position + rotated;
  vec2 clip = world / u_halfViewSize;        // pixels -> clip
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = a_i_color;
}`

const FS = `#version 300 es
precision highp float;
in vec3 v_color;
out vec4 outColor;
void main(){
  outColor = vec4(v_color, 1.0);
}`

export function createRenderer(canvas) {
  /** @type {WebGL2RenderingContext} */
  const gl = canvas.getContext('webgl2', { antialias: true })
  if (!gl) throw new Error('WebGL2 not supported')

  const program = createProgram(gl, VS, FS)
  gl.useProgram(program)
  gl.clearColor(0.02, 0.02, 0.03, 1.0)
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  const uHalfView = gl.getUniformLocation(program, 'u_halfViewSize')

  // Base triangle (pointy), centered near origin, pointing up
  // Coordinates in unit space; scaled in instance
  const baseTri = new Float32Array([
    -0.5, -0.6,
     0.5, -0.6,
     0.0,  0.8,
  ])

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  // Static base geometry
  const baseBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, baseBuf)
  gl.bufferData(gl.ARRAY_BUFFER, baseTri, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  // Instance buffer: [pos.x, pos.y, scale.x, scale.y, rotation, color.r, color.g, color.b]
  const floatsPerInstance = 2 + 2 + 1 + 3
  let instanceCapacity = 512
  let instanceCount = 0
  let instanceData = new Float32Array(instanceCapacity * floatsPerInstance)
  const instanceBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
  gl.bufferData(gl.ARRAY_BUFFER, instanceData.byteLength, gl.DYNAMIC_DRAW)

  const stride = floatsPerInstance * 4
  let offset = 0
  // a_i_position
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, offset)
  gl.vertexAttribDivisor(1, 1)
  offset += 2 * 4
  // a_i_scale
  gl.enableVertexAttribArray(2)
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, offset)
  gl.vertexAttribDivisor(2, 1)
  offset += 2 * 4
  // a_i_rotation
  gl.enableVertexAttribArray(3)
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, offset)
  gl.vertexAttribDivisor(3, 1)
  offset += 1 * 4
  // a_i_color
  gl.enableVertexAttribArray(4)
  gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, offset)
  gl.vertexAttribDivisor(4, 1)

  function ensureCapacity(minInstances) {
    if (minInstances <= instanceCapacity) return
    let next = instanceCapacity
    while (next < minInstances) next *= 2
    const newData = new Float32Array(next * floatsPerInstance)
    newData.set(instanceData.subarray(0, instanceCount * floatsPerInstance))
    instanceData = newData
    instanceCapacity = next
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
    gl.bufferData(gl.ARRAY_BUFFER, instanceData.byteLength, gl.DYNAMIC_DRAW)
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const displayWidth = Math.floor(canvas.clientWidth * dpr)
    const displayHeight = Math.floor(canvas.clientHeight * dpr)
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth
      canvas.height = displayHeight
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(program)
    gl.uniform2f(uHalfView, canvas.width * 0.5, canvas.height * 0.5)
    return { width: canvas.width, height: canvas.height, dpr }
  }

  function beginFrame() {
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  function setInstances(flatArray, count) {
    ensureCapacity(count)
    instanceCount = count
    instanceData.set(flatArray.subarray(0, count * floatsPerInstance), 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData.subarray(0, count * floatsPerInstance))
  }

  function draw() {
    if (instanceCount === 0) return
    gl.bindVertexArray(vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, instanceCount)
  }

  return {
    gl,
    floatsPerInstance,
    resize,
    beginFrame,
    setInstances,
    draw,
  }
}


