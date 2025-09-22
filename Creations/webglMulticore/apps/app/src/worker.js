// Web Worker for computing model-view-projection matrix
import { identity, perspective, translate, rotateX, rotateY, multiply } from './lib/mat4.js'

let basePositions = null // Float32Array of base geometry positions (x,y,z repeated)

function rotateVec3(out, v, rx, ry) {
  // Apply Y then X rotation to vector v
  const sinY = Math.sin(ry), cosY = Math.cos(ry)
  const sinX = Math.sin(rx), cosX = Math.cos(rx)
  const x1 = v[0] * cosY - v[2] * sinY
  const z1 = v[0] * sinY + v[2] * cosY
  const y2 = v[1] * cosX - z1 * sinX
  const z2 = v[1] * sinX + z1 * cosX
  out[0] = x1
  out[1] = y2
  out[2] = z2
}

self.onmessage = (event) => {
  const data = event.data
  if (!data) return

  if (data.type === 'compute') {
    const { timeSec, aspect, cameraDistance = 4 } = data
    const proj = perspective(Math.PI / 3, aspect, 0.1, 100.0)
    let view = identity()
    view = translate(view, [0, 0, -cameraDistance])
    let model = identity()
    model = rotateY(model, timeSec)
    model = rotateX(model, timeSec * 0.7)
    const vp = multiply(proj, view)
    const vpBuf = vp.buffer
    const modelBuf = model.buffer
    self.postMessage({ type: 'result', vp: { buffer: vpBuf, byteOffset: 0, byteLength: 16 * 4 }, model: { buffer: modelBuf, byteOffset: 0, byteLength: 16 * 4 } }, [vpBuf, modelBuf])
    return
  }

  if (data.type === 'initGeometry') {
    const { buffer, length } = data
    if (buffer && typeof length === 'number') {
      basePositions = new Float32Array(buffer, 0, length)
      // Keep a copy in worker memory; buffer will be detached after receipt, so clone to keep
      basePositions = basePositions.slice(0)
    }
    self.postMessage({ type: 'initAck' })
    return
  }

  if (data.type === 'transform') {
    if (!basePositions) return
    const { timeSec } = data
    const rx = timeSec * 0.7
    const ry = timeSec
    const out = new Float32Array(basePositions.length)
    const v = [0, 0, 0]
    for (let i = 0; i < basePositions.length; i += 3) {
      v[0] = basePositions[i]
      v[1] = basePositions[i + 1]
      v[2] = basePositions[i + 2]
      rotateVec3(v, v, rx, ry)
      out[i] = v[0]
      out[i + 1] = v[1]
      out[i + 2] = v[2]
    }
    const buffer = out.buffer
    self.postMessage({ type: 'transformResult', positions: { buffer, byteOffset: 0, byteLength: out.byteLength } }, [buffer])
    return
  }
}


