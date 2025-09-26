## BitBreaker — Implementation TODO

### Setup and Infrastructure
- [ ] Audit `apps/app` scaffold; confirm WebGL2 entry, build, DPR resize.
- [ ] Deterministic PRNG (seed input UI + persistence).
- [ ] Core loop with fixed or semi-fixed timestep and debug overlay.

### Input and Emulator
- [ ] R1 scroll wheel → paddle control (with ramping options).
- [ ] Mouse/touch/keyboard fallbacks; side button mapping for menus.
- [ ] Integrate emulator viewport sizing; letterbox; DPR-aware canvas.

### Rendering
- [ ] HDR render target and post chain.
- [ ] Bloom/glow passes; intensity scales with combo.
- [ ] Instanced/pooled draw paths for bricks/balls/FX.

### Physics and Collision
- [ ] Quadtree broadphase for balls vs bricks/paddle.
- [ ] Circle–AABB narrowphase; elastic reflect; clamps.
- [ ] Tunables: gravity (default 0), speed limits, restitution.

### Objects and Pooling
- [ ] Pools: balls, bricks, power-ups, missiles, lasers, particles.
- [ ] Reuse lists; no GC at runtime under load (target: 5k balls).

### Bricks and Damage
- [ ] Brick model with HP (1–100 later levels), alive/dead flags.
- [ ] Per-hit crack progression via 2D Voronoi damage shader.
- [ ] Starting color determined by HP and level palette.

### FX and Audio
- [ ] Impact sparks and explosions based on collision impulse.
- [ ] Screen shake with threshold and multi-impact accumulation.
- [ ] Synth SFX and music; mixers for master/music/SFX; sliders.

### Power-ups (10 s, stacking)
- [ ] Lasers: stacking adds beams (spread) and power.
- [ ] Missiles: stacking increases count and splash/damage.
- [ ] Multiball: add and multiply; cap total balls at 5,000.
- [ ] HUD timers and stack indicators.

### Combo, Scoring, Bonus
- [ ] Combo increments on destroys; lost on ball wipe; reset per level.
- [ ] Score formula and time bonus vs target.
- [ ] Bonus screen with stats (combo peak, time, accuracy, etc.).

### Level Generation (Seeded, Mixed)
- [ ] Generators: spiral, maze, block/noise areas, shapes.
- [ ] Emoji rasterizer → 50×30, luminance→HP, color→palette.
- [ ] Mixing rules with unions/intersections and weights.

### Palette Generator
- [ ] Oklch-based per-level palette with golden-ratio hue stepping.
- [ ] Seeded jitter; role-based L/C bands; UI contrast checks.

### Progression and Achievements
- [ ] Difficulty curve (ramps, dips, spikes, lulls) across 1,024 levels.
- [ ] Achievements at 2^n levels; toasts and log; persistence.
- [ ] Save progress/settings/seed to localStorage with versioning.

### UI/UX
- [ ] Main menu (Start, Seed, Settings, Credits).
- [ ] Pause (Resume, Restart, Quit, Debug sliders, Volume sliders).
- [ ] Game Over (Restart), Credits (Sean Lavery — powerlevelai.com).
- [ ] Reduced motion toggle.

### Testing and Telemetry
- [ ] Performance counters and quadtree stats.
- [ ] Determinism tests with fixed seeds.
- [ ] Emulator input integration tests.


