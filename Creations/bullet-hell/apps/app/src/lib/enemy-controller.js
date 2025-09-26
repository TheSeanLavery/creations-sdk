// Minimal controller skeleton; movement and firing to be filled in incrementally

export class EnemyController {
  constructor(world, entity, archetype, api, rng) {
    this.world = world
    this.entity = entity
    this.archetype = archetype
    this.api = api // { fireShot(shotRef, origin, facing, rng) }
    this.rng = rng
    this.nextFireAt = 0
    this.state = { phase: 'descend', pauseUntil: 0, nextVxJitterAt: 0, vxTarget: 0 }
    this.firePhaseIdx = 0
    this.firePhaseTime = 0
  }

  update(dt, t, player) {
    const e = this.entity
    const move = this.archetype?.movement
    const use = move?.use
    // Movement programs
    if (use === 'popcornDrift') {
      const vy = -(move.params?.vy || 100)
      if (t >= this.state.nextVxJitterAt) {
        const jitter = (move.params?.vxJitter || 60)
        this.state.vxTarget = (Math.random() * 2 - 1) * jitter
        this.state.nextVxJitterAt = t + (move.params?.vxChangeEvery || 0.7)
      }
      // simple easing towards target vx
      e.vx += (this.state.vxTarget - e.vx) * Math.min(1, dt * 2)
      e.vy = vy
    } else if (use === 'gunshipSweep') {
      // vx assigned on spawn; maintain y band near top using proportional settle (px/s)
      const yTopRatio = move.params?.yTopRatio || 0.85
      const targetY = -this.world.height + 2 * this.world.height * yTopRatio
      const settleGain = 3
      e.vy = (targetY - e.y) * settleGain
      // clamp within bounds softly
      const pad = 20
      if (e.y > this.world.height - pad) e.y = this.world.height - pad
      if (e.y < -this.world.height + pad) e.y = -this.world.height + pad
      // vx remains as set on spawn
    } else if (use === 'bursterStopAndBurst') {
      const vyDown = -(move.params?.vy || 60)
      const stopYRatio = move.params?.stopYRatio || 0.3
      const stopY = this.world.height * (stopYRatio - 1)
      if (this.state.phase === 'descend') {
        e.vy = vyDown
        if (e.y <= stopY) {
          this.state.phase = 'pause'
          this.state.pauseUntil = t + (move.params?.stopDuration || 2)
          e.vy = 0
          // Fire volley at pause moment if configured
          if (this.archetype?.fire?.onPauseOnly && this.archetype.fire.shot) {
            this.api.fireShot(this.archetype.fire.shot, { x: e.x, y: e.y }, { target: player }, this.rng)
          }
        }
      } else if (this.state.phase === 'pause') {
        e.vy = 0
        if (t >= this.state.pauseUntil) {
          this.state.phase = 'resume'
        }
      } else {
        e.vy = -(move.params?.resumeVy || vyDown)
      }
    } else if (use === 'hoverTopBand') {
      // Hover near top with sine x oscillation
      if (e._hoverStartTime == null) { e._hoverStartTime = t; e._hoverBaseX = e.x }
      const yRatio = move.params?.yRatio || 0.8
      const targetY = -this.world.height + 2 * this.world.height * yRatio
      const settleGain = 3
      e.vy = (targetY - e.y) * settleGain
      // x oscillation
      const amp = Math.min(move.params?.sineXAmplitude || 80, this.world.width - 40)
      const freq = move.params?.sineXFreqHz || 0.25
      const sinX = amp * Math.sin(2 * Math.PI * freq * (t - e._hoverStartTime))
      e.vx = 0
      e.x = (e._hoverBaseX || 0) + sinX
      const pad = 20
      if (e.x > this.world.width - pad) e.x = this.world.width - pad
      if (e.x < -this.world.width + pad) e.x = -this.world.width + pad
      if (e.y > this.world.height - pad) e.y = this.world.height - pad
      if (e.y < -this.world.height + pad) e.y = -this.world.height + pad
    }

    // Fire schedule (continuous rate)
    if (this.archetype?.fire?.rate) {
      if (t >= this.nextFireAt) {
        const shot = this.archetype.fire.shot
        this._fireWithFx(shot, player)
        this.nextFireAt = t + (1 / this.archetype.fire.rate)
      }
    }

    // Boss/miniboss fire phases
    if (Array.isArray(this.archetype?.firePhases) && this.archetype.firePhases.length > 0) {
      const e = this.entity
      const phases = this.archetype.firePhases
      // Determine current phase by HP ratio or time progression
      const hpRatio = (e._maxHp || e.hp) > 0 ? e.hp / (e._maxHp || e.hp) : 0
      // If phases use untilHpRatio, select first that matches
      const hasHpPhases = phases.some(p => p.untilHpRatio != null)
      if (hasHpPhases) {
        for (let i = 0; i < phases.length; i++) {
          const p = phases[i]
          if (p.untilHpRatio != null && hpRatio > p.untilHpRatio) { this.firePhaseIdx = i; break }
          if (p.untilHpRatio != null && hpRatio <= p.untilHpRatio) { this.firePhaseIdx = i; break }
        }
      } else {
        // duration-based cycle
        this.firePhaseTime += dt
        let acc = 0
        for (let i = 0; i < phases.length; i++) {
          acc += (phases[i].duration || 5)
          if (this.firePhaseTime <= acc) { this.firePhaseIdx = i; break }
          if (i === phases.length - 1 && this.firePhaseTime > acc) { this.firePhaseTime = 0; this.firePhaseIdx = 0 }
        }
      }
      const cur = phases[this.firePhaseIdx] || phases[0]
      // Basic cadence: 0.3s between emissions unless override
      const cadence = cur.rate ? (1 / cur.rate) : 0.3
      if (t >= this.nextFireAt) {
        const shot = cur.shot || this.archetype.fire?.shot
        this._fireWithFx(shot, player)
        this.nextFireAt = t + cadence
      }
    }
  }

  _fireWithFx(shot, player) {
    const e = this.entity
    // windup+shake FX
    const fx = this.archetype?.onFireFx
    if (fx?.use === 'onFireWindupShake') {
      const windupMs = fx.params?.windupMs || 120
      const shakeMs = fx.params?.shakeMs || 160
      const backPx = fx.params?.windupBackPx || 6
      const now = performance.now()
      e.fxWindupEndMs = now + windupMs
      e.fxWindupBackPx = backPx
      e.fxShakeEndMs = now + windupMs + shakeMs
      e.fxShakePx = fx.params?.shakePx || 3
    }
    this.api.fireShot(shot, { x: e.x, y: e.y }, { target: player }, this.rng)
  }
}


