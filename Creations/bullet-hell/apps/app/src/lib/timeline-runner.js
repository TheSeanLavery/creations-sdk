import { deriveSeed, createRng } from './rng.js'

export class TimelineRunner {
  constructor(level, world, api, levelIndex = 0, allLevels = null) {
    this.level = level
    this.levelIndex = levelIndex
    this.allLevels = allLevels
    this.world = world
    this.api = api // { spawnEnemyById(enemyId, options), hasLivingById(id) }
    this.time = 0
    this.done = false
    this.stageIndex = 0
    this.phaseStates = []
    this.rng = createRng(level.seed >>> 0)
    this.stageGateSpawned = false
    this._initStage()
  }

  _initStage() {
    const stage = this.level.stages[this.stageIndex]
    this.stageGateSpawned = false
    this.phaseStates = stage.phases.map((ph, idx) => ({ id: ph.id, t: 0, cursor: 0, asleepUntil: 0, done: false, rng: createRng(deriveSeed(this.level.seed, ph.id + ':' + idx)) }))
  }

  update(dt) {
    if (this.done) return
    const stage = this.level.stages[this.stageIndex]
    this.time += dt
    // update phases in parallel
    for (let i = 0; i < this.phaseStates.length; i++) {
      const ps = this.phaseStates[i]
      if (ps.done) continue
      ps.t += dt
      const actions = stage.phases[i].actions
      // sleep gate
      if (ps.asleepUntil > this.time) continue
      while (ps.cursor < actions.length) {
        const action = actions[ps.cursor]
        if (action.type === 'sleep') {
          ps.asleepUntil = this.time + (action.duration || 0)
          ps.cursor++
          break
        } else if (action.type === 'spawn') {
          const now = this.time
          // schedule spawns for this action
          const pattern = action.pattern || 'burst'
          const lane = action.lane || 'topRandom'
          if (!ps.spawn || ps.spawn.index !== ps.cursor) {
            ps.spawn = { index: ps.cursor, startedAt: now, emitted: 0, nextAt: now }
          }
          const sp = ps.spawn
          if (pattern === 'burst') {
            const count = action.count | 0
            for (let c = 0; c < count; c++) this.api.spawnEnemyById(action.enemy, { lane, rng: ps.rng })
            ps.cursor++
            ps.spawn = null
            continue
          }
          if (pattern === 'streamLinear') {
            const duration = action.duration || 0
            const rate = action.rate || 0
            const elapsed = now - sp.startedAt
            if (rate > 0) {
              // timer-based emission: emit when now >= nextAt, then schedule next by 1/rate
              let guard = 0
              while (now >= sp.nextAt && guard < 1000) {
                this.api.spawnEnemyById(action.enemy, { lane, rng: ps.rng }); sp.emitted++
                sp.nextAt += (1 / rate)
                guard++
              }
            }
            if (elapsed >= duration) { ps.cursor++; ps.spawn = null }
            break
          }
          if (pattern === 'streamRamping') {
            const duration = action.duration || 0
            const base = action.rate?.base || 0
            const slope = action.rate?.slope || 0
            const elapsed = now - sp.startedAt
            // timer-based emission where the interval shrinks as rate grows; schedule using rate at nextAt
            const rateAt = (t) => Math.max(0.0001, base + slope * t)
            let guard = 0
            while (now >= sp.nextAt && elapsed < duration && guard < 2000) {
              this.api.spawnEnemyById(action.enemy, { lane, rng: ps.rng }); sp.emitted++
              const tNext = sp.nextAt - sp.startedAt
              const r = rateAt(tNext)
              sp.nextAt += (1 / r)
              guard++
            }
            if (elapsed >= duration) { ps.cursor++; ps.spawn = null }
            break
          }
          // unknown: consider done
          ps.cursor++
          ps.spawn = null
        } else {
          ps.cursor++
        }
      }
      if (ps.cursor >= actions.length && (!ps.spawn)) ps.done = true
    }
    // Gate handling and stage/level completion
    const allDone = this.phaseStates.every(ps => ps.done)
    const stageGateId = (stage.miniboss && stage.miniboss.id) || (stage.boss && stage.boss.id) || null
    // If a gate enemy is already spawned, allow it to end the stage/level upon death regardless of phase state
    if (stageGateId && this.stageGateSpawned) {
      const alive = this.api.hasLivingById(stageGateId)
      if (!alive) {
        if (this.stageIndex + 1 < this.level.stages.length) {
          this.stageIndex++
          this._initStage()
        } else {
          this.done = true
        }
        return
      }
    }
    // Spawn gate when phases complete
    if (allDone) {
      if (stageGateId) {
        if (!this.stageGateSpawned) {
          this.api.spawnEnemyById(stageGateId, { lane: 'topRandom', rng: createRng(deriveSeed(this.level.seed, 'gate:' + stageGateId)) })
          this.stageGateSpawned = true
        }
      } else {
        // no gate, proceed when phases complete
        if (this.stageIndex + 1 < this.level.stages.length) {
          this.stageIndex++
          this._initStage()
        } else {
          this.done = true
        }
      }
    }
  }

  loadLevel(nextIndex) {
    if (!this.allLevels) return
    this.levelIndex = nextIndex
    this.level = this.allLevels[this.levelIndex]
    this.time = 0
    this.done = false
    this.stageIndex = 0
    this._initStage()
  }
}


