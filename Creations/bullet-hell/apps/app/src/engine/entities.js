// Entity system: player, enemy, bullets

export const ENTITY_TYPE = {
  Player: 1,
  Enemy: 2,
  PlayerBullet: 3,
  EnemyBullet: 4,
}

const ENEMY_BULLET_POOL_SIZE = 10000

export function createWorld() {
  return {
    time: 0,
    width: 0,
    height: 0,
    player: { x: 0, y: 0, alive: true, radius: 1, lives: 3, invincibleUntil: 0 }, // 1px center hitbox
    enemies: [],
    playerBullets: [],
    enemyBullets: [],
    coins: [],
    powerups: [],
    enemyBulletPool: (() => {
      const pool = []
      for (let i = 0; i < ENEMY_BULLET_POOL_SIZE; i++) {
        pool.push({ x: 0, y: 0, vx: 0, vy: 0, w: 4, h: 8 })
      }
      return pool
    })(),
  }
}

export function spawnEnemy(world, x, y, speed = 40) {
  world.enemies.push({ x, y, vx: 0, vy: speed, w: 16, h: 16, hp: 3 })
}

export function firePlayerBullet(world, x, y, dx = 0, dy = -1, speed = 240) {
  const mag = Math.max(0.0001, Math.hypot(dx, dy))
  world.playerBullets.push({ x, y, vx: (dx / mag) * speed, vy: (dy / mag) * speed, w: 4, h: 8 })
}

export function fireEnemyBullet(world, x, y, dx = 0, dy = 1, speed = 160, extra) {
  const mag = Math.max(0.0001, Math.hypot(dx, dy))
  // Allocate from pool; if none available, drop the bullet
  const b = world.enemyBulletPool.length > 0 ? world.enemyBulletPool.pop() : null
  if (!b) return
  b.x = x; b.y = y
  b.vx = (dx / mag) * speed
  b.vy = (dy / mag) * speed
  b.birthTime = world.time || 0
  b.sineAmp = 0
  b.sineFreqHz = 0
  b.sinePrevOffset = 0
  if (extra) {
    if (extra.sineAmp != null) b.sineAmp = extra.sineAmp
    if (extra.sineFreqHz != null) b.sineFreqHz = extra.sineFreqHz
  }
  // width/height already set in pooled object
  world.enemyBullets.push(b)
}

export function updateWorld(world, dt) {
  world.time += dt
  // Move player bullets
  for (let i = 0; i < world.playerBullets.length; i++) {
    const b = world.playerBullets[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.x < -world.width || b.x > world.width || b.y < -world.height || b.y > world.height) {
      world.playerBullets[i] = world.playerBullets[world.playerBullets.length - 1]
      world.playerBullets.pop(); i--
    }
  }
  // Move enemy bullets
  for (let i = 0; i < world.enemyBullets.length; i++) {
    const b = world.enemyBullets[i]
    // Apply sine modulation along perpendicular to velocity, using delta offset method
    if ((b.sineAmp|0) !== 0 || (b.sineFreqHz|0) !== 0) {
      const speedNow = Math.max(0.0001, Math.hypot(b.vx, b.vy))
      const px = -b.vy / speedNow, py = b.vx / speedNow
      const t = world.time - (b.birthTime || 0)
      const phase = (b.sineFreqHz || 0) * t * Math.PI * 2
      const offset = Math.sin(phase) * (b.sineAmp || 0)
      const delta = offset - (b.sinePrevOffset || 0)
      b.x += px * delta
      b.y += py * delta
      b.sinePrevOffset = offset
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.x < -world.width || b.x > world.width || b.y < -world.height || b.y > world.height) {
      // recycle to pool
      world.enemyBullets[i] = world.enemyBullets[world.enemyBullets.length - 1]
      world.enemyBullets.pop();
      world.enemyBulletPool.push(b)
      i--
    }
  }
  // Move enemies
  for (let i = 0; i < world.enemies.length; i++) {
    const e = world.enemies[i]
    e.x += e.vx * dt
    e.y += e.vy * dt
    if (e.y > world.height + 40) { // cull below screen
      world.enemies[i] = world.enemies[world.enemies.length - 1]
      world.enemies.pop(); i--
    }
  }
  // Move coins towards player (attract)
  const p = world.player
  for (let i = 0; i < world.coins.length; i++) {
    const c = world.coins[i]
    const dx = p.x - c.x, dy = p.y - c.y
    const m = Math.max(0.0001, Math.hypot(dx, dy))
    const speed = c.speed || 220
    c.x += (dx / m) * speed * dt
    c.y += (dy / m) * speed * dt
    if (Math.hypot(c.x - p.x, c.y - p.y) < 12) {
      world.coins[i] = world.coins[world.coins.length - 1]
      world.coins.pop(); i--
      // scoring handled externally
    }
  }
  // Powerups float down slowly
  for (let i = 0; i < world.powerups.length; i++) {
    const u = world.powerups[i]
    u.y += (u.vy || -40) * dt
    if (u.y < -world.height - 40) { world.powerups[i] = world.powerups[world.powerups.length - 1]; world.powerups.pop(); i-- }
  }
}

export function clampPlayer(world, padding = 8) {
  const p = world.player
  p.x = Math.max(-world.width + padding, Math.min(world.width - padding, p.x))
  p.y = Math.max(-world.height + padding, Math.min(world.height - padding, p.y))
}

// Recycle all enemy bullets back into the pool
export function recycleAllEnemyBullets(world) {
  for (let i = 0; i < world.enemyBullets.length; i++) {
    world.enemyBulletPool.push(world.enemyBullets[i])
  }
  world.enemyBullets.length = 0
}

// Recycle enemy bullets within a radius of (x, y)
export function recycleEnemyBulletsWithinRadius(world, x, y, radius) {
  const r2 = radius * radius
  let write = 0
  for (let read = 0; read < world.enemyBullets.length; read++) {
    const b = world.enemyBullets[read]
    const dx = b.x - x
    const dy = b.y - y
    if (dx * dx + dy * dy <= r2) {
      world.enemyBulletPool.push(b)
    } else {
      world.enemyBullets[write++] = b
    }
  }
  world.enemyBullets.length = write
}


