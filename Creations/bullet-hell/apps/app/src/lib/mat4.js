// Minimal 4x4 matrix utilities for WebGL transforms

export function identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
}

export function multiply(a, b) {
  const out = new Float32Array(16)
  for (let i = 0; i < 4; i++) {
    const ai0 = a[i]
    const ai1 = a[i + 4]
    const ai2 = a[i + 8]
    const ai3 = a[i + 12]
    out[i]      = ai0 * b[0]  + ai1 * b[1]  + ai2 * b[2]  + ai3 * b[3]
    out[i + 4]  = ai0 * b[4]  + ai1 * b[5]  + ai2 * b[6]  + ai3 * b[7]
    out[i + 8]  = ai0 * b[8]  + ai1 * b[9]  + ai2 * b[10] + ai3 * b[11]
    out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15]
  }
  return out
}

export function perspective(fovyRad, aspect, near, far) {
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
}

export function translate(m, v) {
  const [x, y, z] = v
  const out = m.slice(0)
  out[12] = m[0] * x + m[4] * y + m[8]  * z + m[12]
  out[13] = m[1] * x + m[5] * y + m[9]  * z + m[13]
  out[14] = m[2] * x + m[6] * y + m[10] * z + m[14]
  out[15] = m[3] * x + m[7] * y + m[11] * z + m[15]
  return out
}

export function rotateX(m, rad) {
  const s = Math.sin(rad), c = Math.cos(rad)
  const r = new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ])
  return multiply(m, r)
}

export function rotateY(m, rad) {
  const s = Math.sin(rad), c = Math.cos(rad)
  const r = new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ])
  return multiply(m, r)
}


