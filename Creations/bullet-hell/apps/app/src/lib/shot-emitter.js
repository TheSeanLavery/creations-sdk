import { shots as shotDefs } from '../config/shots.js'

function deepMerge(base, override) {
  if (!override) return base
  const out = Array.isArray(base) ? base.slice() : { ...(base || {}) }
  for (const k in override) {
    const bv = base ? base[k] : undefined
    const ov = override[k]
    out[k] = (bv && typeof bv === 'object' && !Array.isArray(bv) && typeof ov === 'object' && !Array.isArray(ov))
      ? deepMerge(bv, ov)
      : ov
  }
  return out
}

function resolveShot(ref) {
  if (!ref) return null
  if (ref.id && ref.params) return ref
  if (ref.use) {
    const base = shotDefs[ref.use]
    if (!base) return null
    return deepMerge(base, ref.override || null)
  }
  return null
}

export class ShotEmitter {
  constructor(api) {
    this.api = api // { fireEnemyBullet(x, y, dx, dy, speed, extra) }
  }

  emit(shotRef, origin, facing, rng) {
    const shot = resolveShot(shotRef)
    if (!shot) return
    const p = shot.params || {}
    if (shot.emit === 'bullet') {
      const dir = this._computeDirection(p, origin, facing)
      this.api.fireEnemyBullet(origin.x, origin.y, dir.dx, dir.dy, p.speed || 180, p.sine ? { sineAmp: p.sine.amplitude || 0, sineFreqHz: p.sine.frequencyHz || 0 } : undefined)
      return
    }
    if (shot.emit === 'group') {
      const count = p.count | 0
      const spread = (p.angleSpreadDeg || 0) * Math.PI / 180
      const center = (p.angleCenter != null ? p.angleCenter : -90) * Math.PI / 180
      const start = center - spread * 0.5
      const step = count > 1 ? spread / (count - 1) : 0
      for (let i = 0; i < count; i++) {
        const ang = start + i * step
        const dx = Math.cos(ang), dy = Math.sin(ang)
        this.api.fireEnemyBullet(origin.x, origin.y, dx, dy, p.speed || 180, p.sine ? { sineAmp: p.sine.amplitude || 0, sineFreqHz: p.sine.frequencyHz || 0 } : undefined)
      }
      return
    }
    if (shot.emit === 'sequence') {
      // Minimal: immediate approximation (proper scheduling later)
      const duration = p.duration || 0
      const rate = p.rate || 0
      const total = Math.max(0, Math.floor(duration * rate))
      for (let i = 0; i < total; i++) {
        const dir = this._computeDirection(p, origin, facing)
        this.api.fireEnemyBullet(origin.x, origin.y, dir.dx, dir.dy, p.speed || 180, p.sine ? { sineAmp: p.sine.amplitude || 0, sineFreqHz: p.sine.frequencyHz || 0 } : undefined)
      }
      return
    }
  }

  _computeDirection(p, origin, facing) {
    if (p.aimAtPlayer && facing?.target) {
      const dx = facing.target.x - origin.x
      const dy = facing.target.y - origin.y
      const m = Math.max(0.0001, Math.hypot(dx, dy))
      return { dx: dx / m, dy: dy / m }
    }
    const ang = ((p.angleCenter != null ? p.angleCenter : -90) * Math.PI) / 180
    return { dx: Math.cos(ang), dy: Math.sin(ang) }
  }
}


