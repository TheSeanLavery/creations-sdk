## BitBreaker — Game Design Document

### Credits
- Creator: Sean Lavery
- Website: https://powerlevelai.com

### Overview
- Breakout-inspired 2D arcade built with WebGL2 (no 3D), modern look with glow/bloom.
- Deterministic, seeded procedural levels; 50×30 brick grid; up to 5,000 balls.
- Juicy feel: particles, screen shake, post-processing, impact-driven SFX/FX.

### Targets
- Platform: Web (desktop + mobile webview/emulator).
- Performance: 60 FPS target, stable at up to 5k balls via pooling + batching.
- Canvas scaling: DPR-aware; letterboxed to emulator viewport when needed.

### Controls
- Primary: R1 scroll wheel → horizontal paddle control.
- Fallbacks (web/emulator): mouse/touch drag, arrow keys (Left/Right), wheel.
- Side button (spacebar on web) reserved for confirm in menus.

### Rendering Pipeline
- WebGL2 2D (orthographic). All gameplay rendered to HDR color target.
- Post-processing: bloom/glow via downsampled multi-pass (threshold + blur + composite).
- Bloom intensity scales with current combo; clamp and ease to avoid flicker.
- Instanced or batched drawing for bricks; single-pass sprite/quads for balls/FX.

### Physics
- 2D elastic collisions; no gravity by default (exposed as tunable param).
- Broadphase: quadtree per frame for balls vs bricks and balls vs paddle.
- Narrowphase: circle-vs-AABB; compute normal; reflect velocity with restitution.
- Speed clamping and incremental time-stepping to prevent tunneling.

### Objects and Pooling
- Pooled: balls, bricks, power-ups, missiles, lasers, particles, UI toasts.
- Memory never grows during gameplay; free lists reused.

### Bricks
- Grid: 50 columns × 30 rows; layout per level is procedurally mixed.
- Each brick has starting HP (1–100 in later levels). Color encodes starting HP.
- Visual damage: 2D Voronoi crack overlay in fragment shader, depth increases per hit.
- Each hit advances crack phase; brick breaks on HP ≤ 0 with particles/SFX.

### Particles and Camera Shake
- Sparks and explosion particles spawned on impacts; count/velocity scale with impact speed and collision geometry.
- Direction: use 2D normal; tangent via cross with z-axis convention.
- Screen shake: accumulates from impacts above threshold; multiple simultaneous impacts increase amplitude; decays over time; reduced motion toggle disables.

### Audio
- Synthesized SFX (WebAudio): impact amplitude and filter mapped to collision force.
- Synth music (procedural/loop) with variation per world/seed.
- Mixers: master, music, SFX; exposed as sliders in pause/settings; persisted.

### Power-ups (10 s timers, stacking)
- Lasers: emit from paddle; stacking adds beams (spread) and increases power.
- Missiles: homing from paddle with splash damage; stacking increases missile count and splash/damage.
- Multiball: add balls (+N) and multiply (×2) variants; hard cap at 5,000 balls.
- Timers stack additively; HUD shows per-effect stacks and remaining time.

### Combo and Scoring
- Combo increments on brick destroys; combo lost when all balls are gone.
- Combo does not carry between levels; reset on level start and on ball-wipe.
- Score = sum(basePerHP × HPDestroyed × f(combo)). Time bonus if under target.
- Bloom intensity scales with combo; decouple from score for clarity.

### Level Generation (seeded, mixed per level)
- Seed: player-enterable; all RNG uses deterministic PRNG (e.g., xoshiro/JS splitmix64 seeds).
- Generators (mixed each level):
  - Spiral arms and rings; variable thickness and gaps.
  - Mazes (DFS/Prims) constrained to 50×30; entrances + pockets.
  - Block areas and noise fields (islands, cavities, stripes, checker variants).
  - Emoji rasterizer: pixelize emoji to grid, map color→HP and palette.
  - Shapes (hearts, arrows, letters); rotations/mirroring; per-cell HP gradients.
- Mixing: combine masks via union/intersection/XOR with weight rules per level.

### Emoji Rasterizer
- Render emoji to offscreen canvas at a chosen resolution; downsample to 50×30 with fit + padding.
- Map per-pixel luminance to HP bands; color sampled then remapped to per-level palette.
- Option: Twemoji path if bundled; otherwise rely on native font render.

### Color Palette Generation (per-level)
- Space: Oklch for perceptual control.
- Hue stepping: golden ratio conjugate (≈0.61803398875) per sample (wrap 0–1).
- Chroma/lightness: choose bands per role; jitter with low-discrepancy noise seeded by level.
- Example bands (tunable):
  - Bricks: L ∈ [0.55, 0.75], C ∈ [0.08, 0.20].
  - Background: L ∈ [0.12, 0.18], C ∈ [0.01, 0.06].
  - Particles/highlights: L ∈ [0.70, 0.90], C ∈ [0.15, 0.28].
- Map starting HP to color ramp (e.g., low HP warm; high HP cool) using seeded hue base.
- Ensure UI contrast (WCAG-ish) by adjusting L for text overlays.

### Difficulty Curve (1,024 levels)
- Macro: upward trend with periodic dips (“lulls”) and spiky peaks.
- Parameters that scale: brick HP distribution, density, ball speed caps, paddle size, drop rates, missile/laser intensity cadence.
- Micro: every N levels inject a relief layout; power-up generosity oscillates.
- Achievements at power-of-two levels; toast + log; persistent.

### UI/UX
- Main menu: Start, Seed entry (text + Randomize), Settings, Credits.
- Pause: Resume, Restart, Quit; debug sliders (gravity, ball speed, paddle speed, bloom, shake, drop rates), volume sliders (master/music/SFX).
- Bonus screen (per level): stats, combo peak, time, time bonus vs target.
- Game over: final stats, Restart.
- Credits: “Sean Lavery — powerlevelai.com” link/button.
- Accessibility: Reduced motion toggle (disables shake, reduces particle counts/blur).

### Emulator and Resolution
- Integrate with existing emulator viewport sizing; DPR-aware canvas resize; preserve aspect and letterbox in non-fullscreen.
- Bind scrollUp/scrollDown events to paddle; keyboard/mouse wheel fallback.

### Persistence
- localStorage: settings (volumes, reducedMotion), lastLevel, achievements, seed.
- Safe schema with versioning key; migrate if schema changes.

### Telemetry and Debug
- FPS overlay with rolling averages; object counts; draw calls; quadtree stats.
- Determinism test hooks: fixed seed replay yields identical layouts/spawns.

### Out of Scope
- Any 3D rendering or physics; online features.


