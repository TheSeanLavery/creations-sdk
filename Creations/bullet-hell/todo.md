# Bullet-Hell Refactor TODO

Status: pending review

- [ ] Create config modules scaffolding
  - [ ] `src/config/shots.js`
  - [ ] `src/config/animations.js`
  - [ ] `src/config/enemies.js`
  - [ ] `src/config/levels.js`

- [ ] Implement deterministic RNG helper
  - [ ] Seeded PRNG with split/derive for phases and enemies

- [ ] Implement TimelineRunner (parallel phases + sleeps)
  - [ ] Actions: spawn (burst/streamLinear/streamRamping), sleep
  - [ ] Ensure all spawns begin off-screen
  - [ ] Stage completion gates on miniboss/boss kill

- [ ] Implement EnemyController
  - [ ] Movement via `animations.*`
  - [ ] Fire schedules (rate/onPauseOnly/firePhases)
  - [ ] Local on-fire FX (wind-up + shake)

- [ ] Implement ShotEmitter
  - [ ] Resolve `{ use, override }` with deep-merge
  - [ ] Emit bullet/group/sequence; support nesting
  - [ ] Sine lateral modulation support

- [ ] Integrate into main loop
  - [ ] Replace ad-hoc spawners with TimelineRunner
  - [ ] Hook per-enemy controllers
  - [ ] Keep shared bullet pool usage

- [ ] UI and perf
  - [ ] Global (mini)boss HP bar
  - [ ] Level-complete screen (score, hi-score, combo peak, deaths, time)
  - [ ] Perf overlay tap-to-toggle
  - [ ] Enforce FPS cap at 60

- [ ] Scoring and balancing
  - [ ] Per-enemy score values from `enemies.js`
  - [ ] Confirm combo application on kills

- [ ] Validation
  - [ ] Deterministic playback with fixed seed
  - [ ] Off-screen spawn verification
  - [ ] Bullet pool stability at scale

Notes:
- Times in seconds; world coords in pixels (0,0 center).
- Boss/miniboss sizes and HP defined in `enemies.js`.

## Headed Playwright Tests (high-level)

- [Test config modules load]
  - Launch app; assert no console errors; verify score overlay appears and shows `score` text.
  - Navigate reload; ensure consistent initial UI.

- [Test deterministic RNG]
  - Start with level seed from `levels.js`.
  - Over 5 seconds, sample a debug counter (e.g., `window.__debug.sample()` returning hashes of enemy spawn timeline) and store.
  - Reload and repeat; expect identical samples/hashes.

- [Test TimelineRunner: phases parallel + sleeps]
  - Use a level with two phases: Phase A spawns immediately, Phase B after 2s sleep.
  - Poll counts via `page.evaluate(() => window.__debug.enemiesSummary())` each second; expect A>0 by t<1s; B>0 only after t≥2s; both nonzero while overlapping.

- [Test off-screen spawn]
  - On each spawn, assert initial enemy positions are outside view bounds (debug: expose latest spawn pos array); all y beyond top or x beyond left/right by margin.

- [Test EnemyController: popcorn]
  - Spawn only popcorn for 5s; track a few entities’ x,y over time; expect downward y increase with random lateral drift (|x| changes sign occasionally) and 1 shot/sec per entity (bullet count near N*t within tolerance).

- [Test EnemyController: gunship]
  - Spawn gunships only; assert y stays near top band; x moves steadily from left to right or right to left; no vertical movement; optional: no shots unless enabled.

- [Test EnemyController: burster]
  - Spawn bursters; assert descent to stop band, pause about 2s, then volley occurs; count volley bullets and check wide spread; bullets exhibit sine lateral motion (sample x(t) shows oscillation).

- [Test miniboss/boss: HP bar + completion]
  - Spawn miniboss; assert global HP bar visible with expected width ratio.
  - Use a debug helper to apply damage; on death, assert level complete UI visible and contains stats: score, high score, combo peak, deaths, time.

- [Test ShotEmitter: overrides and nesting]
  - Trigger a shot using `{ use, override }`; compare bullet speed/angle to base; for a nested shot, ensure both parent and child emissions occur.

- [Test spawn patterns]
  - burst: all N enemies present immediately at action start timestamp.
  - streamLinear: count increases linearly with time; slope≈rate.
  - streamRamping: slope increases over time (verify counts in equal windows increase).

- [Test shared bullet pool at scale]
  - Configure high fire rate for a short burst; assert no crashes; max concurrent bullets reaches target; bullets recycle off-screen (pool size recovers afterward).

- [Test scoring]
  - Kill known enemy types via debug; assert score increments by configured values; combo increases and caps at configured max.

- [Test perf overlay toggle]
  - Click on perf overlay; assert it hides; click again; assert it shows.

- [Test FPS cap]
  - Over a fixed 3s wall-clock, sample frame counter `window.__debug.frameCount`; expect ≤ 180 frames (≈60 FPS), allowing small variance.

- [Test level/stage gating]
  - Level with miniboss in Stage 1: assert stage does not complete until miniboss death; after death, proceed to next stage.

Notes for test hooks:
- Expose non-invasive debug API on `window.__debug` in dev/test only: `enemiesSummary()`, `bulletsSummary()`, `frameCount`, `applyDamageTo(typeOrId, amount)`, `sample()` returning deterministic hash for key events.
- Add `data-testid` attributes for HP bar, perf overlay, and level-complete UI.


