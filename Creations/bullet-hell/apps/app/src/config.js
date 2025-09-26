const config = {
  world: {
    playerLives: 9999,
    playerInvincibleMs: 4000,
    bottomYOffsetPx: 24,
  },
  player: {
    moveSpeedY: 180,          // px/s vertical
    keyAccel: 1200,           // px/s^2 horizontal accel from keys
    maxKeySpeed: 220,         // px/s max from key accel
    frictionPerSec: 3,      // decay rate (s^-1) for horizontal velocity
    scrollImpulse: 40,       // px/s per scroll event impulse
    autoFireInterval: 0.06,   // seconds between auto shots (start slower)
    autoBulletSpeed: 320,     // px/s
    spray: {
      count: 3,               // start small; upgrades increase
      spreadDeg: 12,          // start narrow; upgrades increase
      sine: { amplitude: 10, frequencyHz: 6 }, // fast sine for player shots
    },
  },
  enemy: {
    body: { w: 18, h: 22 },
    speedMin: 40,
    speedMax: 70,
    fireInterval: 0.2,        // seconds
    bulletSpeedMin: 140,
    bulletSpeedMax: 200,
    spawn: {
      baseInterval: 0.3,      // seconds between spawns at start
      minInterval: 0.01,      // clamp minimum interval
      accelPerSec: 0.06,      // decrease interval per second (linear)
    },
    hp: 1,
  },
  bullets: {
    size: { w: 6, h: 10 },
  },
  quadtree: {
    capacity: 8,
    maxDepth: 7,
  },
  scoring: {
    enemyKillBase: 10,
    comboMax: 9,
    highScoreKey: 'bh_highscore',
  },
  ui: {
    showPerfOverlay: true,
    perfOffsetTopPx: 8,
  },
}

export default config


