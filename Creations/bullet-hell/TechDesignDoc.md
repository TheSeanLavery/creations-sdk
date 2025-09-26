## Bullet-Hell Refactor: Technical Design

### Goals and non-negotiable requirements
- **JS module configs** at agreed paths; world coordinates in pixels (origin at center).
- **All enemy spawns start off-screen**; movement brings them into view.
- **Levels → stages → phases**. Phases run in parallel; use explicit sleeps to sequence. A phase ends when its spawns are fully scheduled; sleeps can add gaps after.
- **Enemy archetypes**: popcorn (down + random side drift, 1 shot/s aimed), gunship (top pass L→R or R→L, no vertical), burster (descend, stop 2s, wide sine volley), miniboss/boss (hover top, health bar, multiple fire phases). Sizes for bosses defined in config.
- **Shot system**: reusable shot configs, nestable, default params with partial overrides.
- **Shared bullet pool** (10,000) across all shots.
- **Spawn patterns**: burst, stream(linear), stream(ramping). Positions include top-random and top-left/right off-screen lanes.
- **Scoring**: per-enemy values; level complete on boss death; show level-complete screen with stats (score, high score, combo peak, deaths/misses, time).
- **Local on-fire FX**: wind-up backwards and brief shake when firing.
- **Perf overlay toggle**: tap/click to hide/show.
- **Fixed RNG seed** per level for determinism; **FPS capped at 60**.
- **Replace current ad-hoc spawners**; no backwards compatibility mode.

## Module layout (JS modules)
- `creations/bullet-hell/apps/app/src/config/shots.js`
- `creations/bullet-hell/apps/app/src/config/animations.js`
- `creations/bullet-hell/apps/app/src/config/enemies.js`
- `creations/bullet-hell/apps/app/src/config/levels.js`

## Data schemas (object shapes) and examples

### shots.js
Reusable, nestable shot emitters. Support deep-merge via `{ use, override }`.

```js
// shots.js
export const shots = {
  aimedSingle: {
    id: 'aimedSingle',
    emit: 'bullet', // 'bullet' | 'sequence' | 'group'
    params: { speed: 180, size: { w: 6, h: 10 }, color: [1, 0.9, 0.4], aimAtPlayer: true },
  },
  spread5: {
    id: 'spread5',
    emit: 'group',
    params: { count: 5, angleCenter: -90, angleSpreadDeg: 40, speed: 200 },
  },
  sineStream: {
    id: 'sineStream',
    emit: 'sequence',
    params: { duration: 2.0, rate: 8, speed: 180, sine: { amplitude: 36, frequencyHz: 2.2 } },
  },
  bursterVolley: {
    id: 'bursterVolley',
    emit: 'group',
    params: { count: 15, angleCenter: -90, angleSpreadDeg: 80, speed: 160, sine: { amplitude: 30, frequencyHz: 3 } },
  },
  spread5FastWide: { use: 'spread5', override: { params: { speed: 240, angleSpreadDeg: 60 } } },
}
```

Supported shot params
- **Kinematics**: `speed`, `accel`, `lifetime` (optional), `size`, `color`.
- **Aiming/angles**: `angleCenter`, `angleSpreadDeg`, `aimAtPlayer`.
- **Multiplicities**: `count`, `rate`, `duration`.
- **Modulators**: `sine { amplitude, frequencyHz }` lateral oscillation.
- **Offsets/random**: `spawnOffset`, `rngJitter` (seeded).
- **Nesting**: groups/sequence may contain children shot references.

### animations.js
Movement programs and local FX (pure functions parameterized by time and params).

```js
// animations.js
export const animations = {
  popcornDrift: { id: 'popcornDrift', params: { vy: 100, vxJitter: 60, vxChangeEvery: 0.7 } },
  gunshipSweep: { id: 'gunshipSweep', params: { yTopRatio: 0.85, vx: 70 } },
  bursterStopAndBurst: { id: 'bursterStopAndBurst', params: { vy: 60, stopYRatio: 0.3, stopDuration: 2.0, resumeVy: 60 } },
  hoverTopBand: { id: 'hoverTopBand', params: { yRatio: 0.8, sineXAmplitude: 80, sineXFreqHz: 0.25 } },
  onFireWindupShake: { id: 'onFireWindupShake', params: { windupBackPx: 6, windupMs: 120, shakePx: 3, shakeMs: 160 } },
}
```

### enemies.js
Archetypes compose movement + fire schedule + shots + scoring; bosses define size and HP.

```js
// enemies.js
export const enemies = {
  popcorn: {
    id: 'popcorn', size: { w: 16, h: 16 }, hp: 1, score: 10,
    movement: { use: 'popcornDrift' },
    fire: { rate: 1.0, shot: { use: 'aimedSingle' } }, // 1/s aimed
    onFireFx: { use: 'onFireWindupShake' },
  },
  gunship: {
    id: 'gunship', size: { w: 22, h: 20 }, hp: 3, score: 25,
    movement: { use: 'gunshipSweep' },
    spawn: { side: 'leftOrRightTop' }, // L or R, top lane
    fire: null,
  },
  burster: {
    id: 'burster', size: { w: 20, h: 20 }, hp: 5, score: 50,
    movement: { use: 'bursterStopAndBurst' },
    fire: { onPauseOnly: true, shot: { use: 'bursterVolley' } },
    onFireFx: { use: 'onFireWindupShake' },
  },
  minibossA: {
    id: 'minibossA', size: { w: 60, h: 44 }, hp: 400, boss: true, score: 500,
    movement: { use: 'hoverTopBand' },
    firePhases: [
      { duration: 6, shot: { use: 'spread5' } },
      { duration: 8, shot: { use: 'sineStream' } },
    ],
  },
  bossA: {
    id: 'bossA', size: { w: 80, h: 64 }, hp: 1200, boss: true, score: 2000,
    movement: { use: 'hoverTopBand', override: { params: { sineXAmplitude: 110 } } },
    firePhases: [
      { untilHpRatio: 0.66, shot: { use: 'spread5FastWide' } },
      { untilHpRatio: 0.33, shot: { use: 'sineStream', override: { params: { rate: 12 } } } },
      { untilHpRatio: 0.0, shot: { use: 'bursterVolley' } },
    ],
  },
}
```

### levels.js
Parallel phases; use sleeps to sequence within each phase. Stage may declare miniboss/boss that gates completion.

```js
// levels.js
export const levels = [
  {
    id: 'L1', seed: 12345, fpsCap: 60,
    stages: [
      {
        id: 'S1',
        phases: [
          { id: 'P-popcorn-streams', actions: [
            { type: 'spawn', enemy: 'popcorn', pattern: 'streamLinear', duration: 8, rate: 6, lane: 'topRandom' },
            { type: 'sleep', duration: 2 },
            { type: 'spawn', enemy: 'gunship', pattern: 'burst', count: 2, positions: 'topLeftRightOffscreen' },
          ]},
          { id: 'P-bursters', actions: [
            { type: 'sleep', duration: 4 },
            { type: 'spawn', enemy: 'burster', pattern: 'streamRamping', duration: 6, rate: { base: 1.5, slope: 0.5 } },
          ]},
        ],
        miniboss: { id: 'minibossA' },
      },
      {
        id: 'S2',
        phases: [
          { id: 'P-popcorn-dense', actions: [
            { type: 'spawn', enemy: 'popcorn', pattern: 'streamLinear', duration: 10, rate: 10 },
          ]},
        ],
        boss: { id: 'bossA' },
      },
    ],
  },
]
```

Spawn patterns and positions
- **burst**: spawn `count` immediately.
- **streamLinear**: constant `rate` for `duration`.
- **streamRamping**: `rate(t) = base + slope*t` for `duration` (optional clamps).
- **Positions**: `topRandom` (x randomized, y above screen), `topLeftRightOffscreen` (L/R beyond edges), or explicit `positions: [{x,y}, ...]`.

## Engine components and semantics

### TimelineRunner
- Consumes a `level` definition; manages seeded RNG.
- Starts all phases in parallel; executes each phase’s `actions` in order.
- Emits spawns by calling an enemy factory that ensures off-screen positions; schedules sleeps.
- Stage completion: waits for miniboss/boss kill if set; otherwise waits for all phase spawns to finish and enemies to be cleared.

### EnemyController
- Holds movement program (`animations.*`) and fire schedule.
- For continuous `fire.rate`: emit per-second using seeded RNG jitter (optional).
- For `onPauseOnly`: emit during the defined pause (burster stop).
- For bosses: `firePhases` selected by time or HP thresholds.
- Triggers local on-fire FX (wind-up + shake) when firing.

### ShotEmitter
- Resolves shot by `{ id | use + override }`, deep-merges params, and emits:
  - Single bullet, group (burst), or time-based sequence (stream).
  - Nested shots are supported recursively.
- Bullets allocated from shared pool; recycled when off-screen.

### RNG and determinism
- Level-level seed; derive phase and per-enemy seeds (e.g., SplitMix/XorShift*).
- All randomness (spawn positions, popcorn drift, jitter) uses this PRNG.

### Rendering, perf, and UI
- **FPS cap**: clamp `dt` to 1/60; schedule with `requestAnimationFrame`.
- Perf overlay: add click/tap listener to toggle visibility.
- Global boss HP bar at screen top while a (mini)boss is active.
- Level-complete UI on boss death: show score, high score, combo peak, deaths/misses, elapsed time.

## Scoring and progression
- Per-enemy `score` in `enemies.js`. Combo system remains (already implemented); apply gains on kills.
- Stage ends on miniboss death; level ends on boss death.

## Implementation plan (incremental)
1) Add config modules with initial entries: `shots.js`, `animations.js`, `enemies.js`, `levels.js`.
2) Implement deterministic `rng.js` helper (seeded PRNG + split function).
3) Implement `TimelineRunner` (parallel phases, actions: spawn/sleep; ramping/linear rates).
4) Implement `EnemyController` (movement programs + fire schedules + on-fire FX hooks).
5) Implement `ShotEmitter` (nestable emitters; uses shared pool).
6) Replace `main.js` spawners with `TimelineRunner` and per-enemy controllers; ensure off-screen spawns.
7) Add boss HP bar and level-complete UI; add perf overlay tap-to-toggle.
8) Ensure FPS cap and validate determinism with fixed seed; tune pooling/perf.

## Notes
- Coordinate system: pixels; world center at (0,0); spawn off-screen margins should exceed half-view plus sprite half-size.
- Bullet pool remains shared (10k); CPU/GPU instance buffers already grow dynamically.


