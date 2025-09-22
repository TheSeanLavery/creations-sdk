const config = {
  world: {
    playerLives: 3,
    playerInvincibleMs: 2000,
    bottomYOffsetPx: 24,
  },
  player: {
    moveSpeedY: 180,          // px/s vertical
    keyAccel: 1200,           // px/s^2 horizontal accel from keys
    maxKeySpeed: 220,         // px/s max from key accel
    frictionPerSec: 3,      // decay rate (s^-1) for horizontal velocity
    scrollImpulse: 40,       // px/s per scroll event impulse
    autoFireInterval: 0.09,   // seconds between auto shots
    autoBulletSpeed: 300,     // px/s
    spray: {
      count: 5,               // number of bullets per volley
      spreadDeg: 24,          // total spread angle in degrees
    },
  },
  enemy: {
    body: { w: 18, h: 22 },
    speedMin: 40,
    speedMax: 70,
    fireInterval: 0.6,        // seconds
    bulletSpeedMin: 140,
    bulletSpeedMax: 200,
    spawn: {
      baseInterval: 0.9,      // seconds between spawns at start
      minInterval: 0.25,      // clamp minimum interval
      accelPerSec: 0.03,      // decrease interval per second (linear)
    },
    hp: 3,
  },
  bullets: {
    size: { w: 6, h: 10 },
  },
  quadtree: {
    capacity: 8,
    maxDepth: 7,
  },
}

export default config


