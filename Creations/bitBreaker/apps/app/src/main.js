import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'

// Configure viewport for device-like behavior
uiDesign.setupViewport()
deviceControls.init()

const canvas = document.getElementById('glcanvas')
/** @type {WebGL2RenderingContext} */
const gl = canvas.getContext('webgl2', { antialias: true })
if (!gl) {
  console.error('WebGL2 not supported')
}

// World coordinates (game logic) — match device viewport for simplicity
const WORLD_W = 240
const WORLD_H = 320

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader) || 'Shader compile error')
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program) || 'Program link error')
    gl.deleteProgram(program)
    return null
  }
  return program
}

const vs2d = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;       // unit quad verts [-0.5,0.5]
layout(location=1) in vec2 a_instPos;   // world center
layout(location=2) in vec2 a_instSize;  // world size
layout(location=3) in vec4 a_color;
uniform vec2 u_worldSize;
out vec4 v_color;
void main(){
  vec2 world = a_instPos + a_pos * a_instSize;
  vec2 ndc = (world / u_worldSize) * 2.0 - 1.0;
  ndc.y = -ndc.y; // flip Y to screen coords
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_color = a_color;
}`

const fs2d = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main(){ outColor = v_color; }`

const program = createProgram(gl, vs2d, fs2d)
gl.useProgram(program)

// Simple bloom: render to offscreen color then bright-pass + blur (MVP: one-pass naive blur)
const offColor = gl.createTexture()
const offFbo = gl.createFramebuffer()
let offW = 0, offH = 0
function ensureOffscreen() {
  if (offW === canvas.width && offH === canvas.height) return
  offW = canvas.width; offH = canvas.height
  gl.bindTexture(gl.TEXTURE_2D, offColor)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, offW, offH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, offFbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, offColor, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

// Post FS for bright pass (threshold) and naive blur combine
const fsPost = `#version 300 es
precision highp float;
out vec4 outColor;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;
uniform float u_bloom;
void main(){
  vec2 texel = 1.0 / vec2(textureSize(u_tex, 0));
  vec3 c = texture(u_tex, v_uv).rgb;
  vec3 sum = vec3(0.0);
  // 9-tap blur around
  for (int dy = -1; dy <= 1; ++dy) {
    for (int dx = -1; dx <= 1; ++dx) {
      vec2 uv = v_uv + vec2(float(dx), float(dy)) * texel * 1.5;
      vec3 s = texture(u_tex, uv).rgb;
      float b = max(0.0, max(max(s.r, s.g), s.b) - u_threshold);
      sum += s * b;
    }
  }
  sum /= 9.0;
  vec3 outc = c + sum * u_bloom;
  outColor = vec4(outc, 1.0);
}`

const vsPost = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const postProg = createProgram(gl, vsPost, fsPost)
const postUThresh = gl.getUniformLocation(postProg, 'u_threshold')
const postUBloom = gl.getUniformLocation(postProg, 'u_bloom')
const postUTex = gl.getUniformLocation(postProg, 'u_tex')
const postVao = gl.createVertexArray()
gl.bindVertexArray(postVao)
const postQuad = new Float32Array([
  -1,-1, 1,-1, 1,1,
  -1,-1, 1,1, -1,1
])
const postBuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, postBuf)
gl.bufferData(gl.ARRAY_BUFFER, postQuad, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

// Shared unit quad
const quad = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
   0.5,  0.5,
  -0.5, -0.5,
   0.5,  0.5,
  -0.5,  0.5,
])

const vao = gl.createVertexArray()
gl.bindVertexArray(vao)

const vbuf = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, vbuf)
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

// Instance buffers
const instPosBuf = gl.createBuffer()
const instSizeBuf = gl.createBuffer()
const instColorBuf = gl.createBuffer()

gl.bindBuffer(gl.ARRAY_BUFFER, instPosBuf)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0)
gl.vertexAttribDivisor(1, 1)

gl.bindBuffer(gl.ARRAY_BUFFER, instSizeBuf)
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0)
gl.vertexAttribDivisor(2, 1)

gl.bindBuffer(gl.ARRAY_BUFFER, instColorBuf)
gl.enableVertexAttribArray(3)
gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0)
gl.vertexAttribDivisor(3, 1)

const uWorldSize = gl.getUniformLocation(program, 'u_worldSize')

gl.disable(gl.DEPTH_TEST)
gl.clearColor(0.02, 0.02, 0.03, 1)

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const displayWidth = Math.floor(canvas.clientWidth * dpr)
  const displayHeight = Math.floor(canvas.clientHeight * dpr)
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth
    canvas.height = displayHeight
  }
  gl.viewport(0, 0, canvas.width, canvas.height)
}

// Simple RNG (splitmix-like)
let rngStateHi = 0x9E3779B9 >>> 0
let rngStateLo = 0x243F6A88 >>> 0
function seedRng(seed) {
  rngStateHi = (seed ^ 0x9E3779B9) >>> 0
  rngStateLo = (seed * 1664525 + 1013904223) >>> 0
}
function rnd() {
  let x = (rngStateLo += 0x6D2B79F5) >>> 0
  let y = (rngStateHi += 0x85EBCA6B) >>> 0
  x ^= x >>> 15; x = Math.imul(x, 0x2C1B3C6D)
  x ^= x >>> 12; x = Math.imul(x, 0x297A2D39)
  x ^= x >>> 15
  y ^= y >>> 15; y = Math.imul(y, 0x2C1B3C6D)
  y ^= y >>> 12; y = Math.imul(y, 0x297A2D39)
  y ^= y >>> 15
  return ((x ^ y) >>> 0) / 0xFFFFFFFF
}

// Game state
const BRICKS_W = 50
const BRICKS_H = 30
const PADDLE_W = 28
const PADDLE_H = 6
const BALL_SIZE = 4
const WALL = { left: 0, right: WORLD_W, top: 0, bottom: WORLD_H }

let paddleX = WORLD_W * 0.5
let paddleY = WORLD_H - 16
let paddleVX = 0
const PADDLE_FRICTION = 6.0 // per-second damping
const PADDLE_IMPULSE = 140 // pixels/s per wheel tick

// Object pools
const ballPool = []
const balls = [] // active
function ballGet() {
  return ballPool.length > 0 ? ballPool.pop() : { x:0,y:0,vx:0,vy:0 }
}
function ballRelease(b) {
  ballPool.push(b)
}

const powerPool = []
const powers = [] // active falling powerups {x,y,w,h,vy,type}
function powGet() { return powerPool.length ? powerPool.pop() : { x:0,y:0,w:8,h:8,vy:30,type:0 } }
function powRelease(p) { powerPool.push(p) }

// Bricks preallocated as pooled grid
const bricks = [] // {x,y,w,h,hp,alive}

// Coord-hash noise [0,1)
function hashNoise(ix, iy, seed) {
  let a = (ix | 0) * 374761393 ^ (iy | 0) * 668265263 ^ (seed | 0)
  a = (a ^ (a >>> 13)) >>> 0
  a = Math.imul(a, 1274126177) >>> 0
  return (a >>> 0) / 0xFFFFFFFF
}
function rndInt(maxExclusive) { return Math.floor(rnd() * maxExclusive) }

let baseSeed = 12345
let currentLevel = 1
let nextLevelPending = false
let levelPalette = {
  bg: [0.02, 0.02, 0.03],
  brick1: [0.9, 0.4, 0.4],
  brick2: [0.4, 0.9, 0.5],
  brick3: [0.4, 0.6, 0.9],
  paddle: [1, 1, 1],
  ball: [1, 1, 0.3]
}

// Seeded mixed layout generator with edge gaps
function resetBricks(levelSeed) {
  bricks.length = 0
  const GAP_X = 8
  const GAP_TOP = 10
  const availW = WORLD_W - GAP_X * 2
  const availH = WORLD_H * 0.6
  const cellW = availW / BRICKS_W
  const cellH = availH / BRICKS_H
  const ox = GAP_X
  const oy = GAP_TOP
  // Maze-only layout (no mixing)
  const mazeCols = 25, mazeRows = 15
  const { mask: mazeMask, width: coarseW, height: coarseH } = generateMazeMask(mazeCols, mazeRows, levelSeed ^ 0xA2C79)
  for (let gy = 0; gy < BRICKS_H; gy++) {
    for (let gx = 0; gx < BRICKS_W; gx++) {
      // World center of the cell
      const x = ox + gx * cellW + cellW * 0.5
      const y = oy + gy * cellH + cellH * 0.5
      // Maze wall mapping
      const u = Math.max(0, Math.min(coarseW - 1, Math.floor(((gx + 0.5) / BRICKS_W) * coarseW)))
      const v = Math.max(0, Math.min(coarseH - 1, Math.floor(((gy + 0.5) / BRICKS_H) * coarseH)))
      const mazeWall = mazeMask[v * coarseW + u] === 1
      const alive = mazeWall
      const hp = 1 + ((gx + gy + (levelSeed & 7)) % 3)
      bricks.push({ x, y, w: cellW * 0.95, h: cellH * 0.9, hp: alive ? hp : 0, alive })
    }
  }
}

function fract(v) { return v - Math.floor(v) }

// Generate a maze mask using DFS backtracking on a (2c+1)x(2r+1) grid
function generateMazeMask(cols, rows, seed) {
  // Grid of walls (1) and passages (0)
  const W = cols * 2 + 1
  const H = rows * 2 + 1
  const mask = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) mask[i] = 1
  // Seed RNG deterministically for maze
  const savedHi = rngStateHi, savedLo = rngStateLo
  seedRng(seed)
  const visited = new Uint8Array(cols * rows)
  const stack = []
  function idx(c, r) { return r * cols + c }
  function openCell(c, r) { mask[(r * 2 + 1) * W + (c * 2 + 1)] = 0 }
  function openWall(c0, r0, c1, r1) { mask[(r0 + r1 + 1) * W + (c0 + c1 + 1)] = 0 }
  let c = rndInt(cols), r = rndInt(rows)
  visited[idx(c, r)] = 1
  openCell(c, r)
  stack.push([c, r])
  while (stack.length) {
    const top = stack[stack.length - 1]
    c = top[0]; r = top[1]
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
    // Shuffle directions
    for (let i = dirs.length - 1; i > 0; i--) { const j = rndInt(i + 1); const t = dirs[i]; dirs[i] = dirs[j]; dirs[j] = t }
    let moved = false
    for (let i = 0; i < 4; i++) {
      const dc = dirs[i][0], dr = dirs[i][1]
      const nc = c + dc, nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      if (visited[idx(nc, nr)]) continue
      visited[idx(nc, nr)] = 1
      openCell(nc, nr)
      openWall(c, r, nc, nr)
      stack.push([nc, nr])
      moved = true
      break
    }
    if (!moved) stack.pop()
  }
  // Add entrance and exit by opening outer walls
  const entC = 0, entR = 0
  const exC = cols - 1, exR = rows - 1
  openCell(entC, entR)
  openCell(exC, exR)
  // Remove walls at outer boundary near entrance/exit
  mask[(entR * 2 + 1) * W + 0] = 0
  mask[(exR * 2 + 1) * W + (W - 1)] = 0
  // Restore RNG state
  rngStateHi = savedHi; rngStateLo = savedLo
  return { mask, width: W, height: H }
}

function spawnBall(x, y, speed = 120, angle = -Math.PI / 4) {
  const b = ballGet()
  b.x = x; b.y = y
  b.vx = Math.cos(angle) * speed
  b.vy = Math.sin(angle) * speed
  balls.push(b)
}
function addBalls(count) {
  const speed = 110
  for (let i = 0; i < count && balls.length < 5000; i++) {
    const a = (-Math.PI * 0.75) + rnd() * (Math.PI * 0.5)
    spawnBall(paddleX, paddleY - 16, speed, a)
  }
}

let lives = 3
let gameOver = false

function loadLevel(level, resetLives) {
  currentLevel = level
  const levelSeed = (baseSeed ^ (level * 0x9E3779B9)) >>> 0
  powers.length = 0
  seedRng(levelSeed)
  levelPalette = generatePalette(levelSeed)
  resetBricks(levelSeed)
  balls.length = 0
  spawnBall(paddleX, paddleY - 20, 120, -Math.PI * 0.6)
  if (resetLives) { lives = 3; gameOver = false }
}

function reflectBall(ball, nx, ny) {
  const dot = ball.vx * nx + ball.vy * ny
  ball.vx -= 2 * dot * nx
  ball.vy -= 2 * dot * ny
}

// Quadtree for bricks
class QuadTree {
  constructor(x, y, w, h, depth = 0, maxDepth = 6, cap = 12) {
    this.x = x; this.y = y; this.w = w; this.h = h
    this.depth = depth; this.maxDepth = maxDepth; this.cap = cap
    this.items = [] // {rx0,ry0,rx1,ry1,ref}
    this.kids = null
  }
  insert(aabb) {
    if (this.kids) { this._insertIntoKids(aabb); return }
    this.items.push(aabb)
    if (this.items.length > this.cap && this.depth < this.maxDepth) this._split()
  }
  _split() {
    const hw = this.w * 0.5, hh = this.h * 0.5
    this.kids = [
      new QuadTree(this.x, this.y, hw, hh, this.depth + 1, this.maxDepth, this.cap),
      new QuadTree(this.x + hw, this.y, hw, hh, this.depth + 1, this.maxDepth, this.cap),
      new QuadTree(this.x, this.y + hh, hw, hh, this.depth + 1, this.maxDepth, this.cap),
      new QuadTree(this.x + hw, this.y + hh, hw, hh, this.depth + 1, this.maxDepth, this.cap),
    ]
    const old = this.items; this.items = []
    for (let i = 0; i < old.length; i++) this._insertIntoKids(old[i])
  }
  _insertIntoKids(a) {
    for (let i = 0; i < 4; i++) {
      const k = this.kids[i]
      if (a.rx1 > k.x && a.rx0 < k.x + k.w && a.ry1 > k.y && a.ry0 < k.y + k.h) {
        k.insert(a)
      }
    }
  }
  query(qx0, qy0, qx1, qy1, out) {
    if (qx1 <= this.x || qx0 >= this.x + this.w || qy1 <= this.y || qy0 >= this.y + this.h) return out
    for (let i = 0; i < this.items.length; i++) out.push(this.items[i])
    if (this.kids) for (let i = 0; i < 4; i++) this.kids[i].query(qx0, qy0, qx1, qy1, out)
    return out
  }
}

let brickTree = null
function rebuildBrickTree() {
  brickTree = new QuadTree(0, 0, WORLD_W, WORLD_H)
  for (let j = 0; j < bricks.length; j++) {
    const br = bricks[j]
    if (!br.alive) continue
    brickTree.insert({ rx0: br.x - br.w * 0.5, ry0: br.y - br.h * 0.5, rx1: br.x + br.w * 0.5, ry1: br.y + br.h * 0.5, ref: j })
  }
}

function step(dt) {
  // Paddle motion with momentum + friction (disable while menu shown)
  if (showMenu) {
    paddleVX = 0
  }
  paddleX += paddleVX * dt
  const damp = Math.exp(-PADDLE_FRICTION * dt)
  paddleVX *= damp
  const half = PADDLE_W * 0.5
  if (paddleX < half) { paddleX = half; paddleVX = Math.abs(paddleVX) }
  if (paddleX > WORLD_W - half) { paddleX = WORLD_W - half; paddleVX = -Math.abs(paddleVX) }

  // Rebuild quadtree for current bricks
  rebuildBrickTree()
  // Paddle bounds
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    // Walls
    if (b.x < BALL_SIZE * 0.5) { b.x = BALL_SIZE * 0.5; b.vx *= -1 }
    if (b.x > WORLD_W - BALL_SIZE * 0.5) { b.x = WORLD_W - BALL_SIZE * 0.5; b.vx *= -1 }
    if (b.y < BALL_SIZE * 0.5) { b.y = BALL_SIZE * 0.5; b.vy *= -1 }
    if (b.y > WORLD_H + 20) { ballRelease(b); balls.splice(i, 1); i--; continue }
    // Paddle collision (AABB)
    const px0 = paddleX - PADDLE_W * 0.5
    const px1 = paddleX + PADDLE_W * 0.5
    const py0 = paddleY - PADDLE_H * 0.5
    const py1 = paddleY + PADDLE_H * 0.5
    if (b.x + BALL_SIZE * 0.5 > px0 && b.x - BALL_SIZE * 0.5 < px1 && b.y + BALL_SIZE * 0.5 > py0 && b.y - BALL_SIZE * 0.5 < py1) {
      b.y = py0 - BALL_SIZE * 0.5
      b.vy = -Math.abs(b.vy)
      const u = (b.x - paddleX) / (PADDLE_W * 0.5)
      b.vx = u * 120
    }
  }
  // Ball vs bricks using quadtree broadphase
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i]
    const bx0 = b.x - BALL_SIZE * 0.5
    const bx1 = b.x + BALL_SIZE * 0.5
    const by0 = b.y - BALL_SIZE * 0.5
    const by1 = b.y + BALL_SIZE * 0.5
    const candidates = []
    brickTree.query(bx0, by0, bx1, by1, candidates)
    for (let k = 0; k < candidates.length; k++) {
      const br = bricks[candidates[k].ref]
      if (!br || !br.alive) continue
      const rx0 = br.x - br.w * 0.5
      const rx1 = br.x + br.w * 0.5
      const ry0 = br.y - br.h * 0.5
      const ry1 = br.y + br.h * 0.5
      if (bx1 > rx0 && bx0 < rx1 && by1 > ry0 && by0 < ry1) {
        const dxLeft = bx1 - rx0
        const dxRight = rx1 - bx0
        const dyTop = by1 - ry0
        const dyBottom = ry1 - by0
        const minX = Math.min(dxLeft, dxRight)
        const minY = Math.min(dyTop, dyBottom)
        if (minX < minY) {
          b.vx *= -1
          b.x += (dxLeft < dxRight ? -minX : minX) * 0.5 * Math.sign(b.vx || 1)
        } else {
          b.vy *= -1
          b.y += (dyTop < dyBottom ? -minY : minY) * 0.5 * Math.sign(b.vy || 1)
        }
        br.hp -= 1
        score += 10
        if (br.hp <= 0) {
          br.alive = false
          // High chance to spawn multiball powerups for perf testing
          if (rnd() < 0.6) {
            const p = powGet(); p.x = br.x; p.y = br.y; p.w = 8; p.h = 8; p.vy = 40; p.type = 1; powers.push(p)
          }
        }
        break
      }
    }
  }

  // Powerups falling and pickup
  for (let i = 0; i < powers.length; i++) {
    const p = powers[i]
    p.y += p.vy * dt
    if (p.y > WORLD_H + 10) { powRelease(p); powers.splice(i, 1); i--; continue }
    const px0 = paddleX - PADDLE_W * 0.5, px1 = paddleX + PADDLE_W * 0.5
    const py0 = paddleY - PADDLE_H * 0.5, py1 = paddleY + PADDLE_H * 0.5
    if (p.x + p.w * 0.5 > px0 && p.x - p.w * 0.5 < px1 && p.y + p.h * 0.5 > py0 && p.y - p.h * 0.5 < py1) {
      // Collect: spawn many balls
      addBalls(16)
      powRelease(p); powers.splice(i, 1); i--; continue
    }
  }

  // Lives and reset on ball wipe
  if (balls.length === 0 && !gameOver) {
    lives -= 1
    if (lives > 0) {
      spawnBall(paddleX, paddleY - 20, 120, -Math.PI * 0.5)
    } else {
      gameOver = true
      if (overlayEl && overlayText && btnRestart) {
        overlayText.textContent = 'Game Over'
        overlayEl.style.display = 'flex'
        btnRestart.style.display = 'inline-block'
        btnRestart.onclick = () => {
          overlayEl.style.display = 'none'
          btnRestart.style.display = 'none'
          baseSeed = (Math.random() * 1e9) | 0
          loadLevel(1, true)
        }
  } else {
        baseSeed = (Math.random() * 1e9) | 0
        loadLevel(1, true)
      }
    }
  }

  // Next level when all bricks are cleared
  let remaining = 0
  for (let j = 0; j < bricks.length; j++) if (bricks[j].alive) remaining++
  if (remaining === 0 && !nextLevelPending) {
    nextLevelPending = true
    if (overlayEl && overlayText) {
      overlayText.textContent = `Level ${currentLevel} cleared!`
      overlayEl.style.display = 'flex'
      setTimeout(() => {
        overlayEl.style.display = 'none'
        nextLevelPending = false
        loadLevel(currentLevel + 1, false)
      }, 1000)
    } else {
      nextLevelPending = false
      loadLevel(currentLevel + 1, false)
    }
  }
}

// Rendering batches
const posData = []
const sizeData = []
const colorData = []

function pushInstance(x, y, w, h, r, g, b, a) {
  posData.push(x, y)
  sizeData.push(w, h)
  colorData.push(r, g, b, a)
}

function drawInstances() {
  const pos = new Float32Array(posData)
  const size = new Float32Array(sizeData)
  const col = new Float32Array(colorData)
  gl.bindBuffer(gl.ARRAY_BUFFER, instPosBuf)
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, instSizeBuf)
  gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, instColorBuf)
  gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, pos.length / 2)
}

// Simple OKLCH-ish palette generator using HCL approximation
function generatePalette(seed) {
  // Save/restore RNG state and use hashNoise as deterministic base
  const savedHi = rngStateHi, savedLo = rngStateLo
  seedRng(seed ^ 0xBEEF1234)
  const golden = 0.61803398875
  let h = (hashNoise(1, 2, seed) * 360) % 360
  function hclToRgb(hDeg, c, l) {
    // Quick and dirty HCL-like mapping using HSL as approximation for now
    const hNorm = ((hDeg % 360) + 360) % 360 / 360
    const s = Math.min(1, Math.max(0, c))
    const v = l
    // Convert HSV to RGB
    const i = Math.floor(hNorm * 6)
    const f = hNorm * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    let r, g, b
    switch (i % 6) {
      case 0: r=v; g=t; b=p; break
      case 1: r=q; g=v; b=p; break
      case 2: r=p; g=v; b=t; break
      case 3: r=p; g=q; b=v; break
      case 4: r=t; g=p; b=v; break
      case 5: r=v; g=p; b=q; break
    }
    return [r,g,b]
  }
  function nextHue() { h = (h + golden * 360) % 360; return h }
  const bg = hclToRgb(h, 0.08, 0.06)
  const b1 = hclToRgb(nextHue(), 0.85, 0.75)
  const b2 = hclToRgb(nextHue(), 0.95, 0.78)
  const b3 = hclToRgb(nextHue(), 0.9, 0.82)
  const paddle = hclToRgb(nextHue(), 0.1, 0.98)
  const ball = hclToRgb(nextHue(), 0.3, 0.98)
  rngStateHi = savedHi; rngStateLo = savedLo
  return { bg, brick1: b1, brick2: b2, brick3: b3, paddle, ball }
}

// HUD
const hudEl = document.getElementById('hud')
const menuEl = document.getElementById('menu')
const overlayEl = document.getElementById('overlay')
const seedInput = document.getElementById('seed-input')
const startBtn = document.getElementById('btn-start')
const overlayText = document.getElementById('overlay-text')
const btnRestart = document.getElementById('btn-restart')
let showMenu = true
let showOverlay = false
let score = 0
startBtn?.addEventListener('click', () => {
  baseSeed = parseInt(seedInput?.value || '12345', 10) || 12345
  loadLevel(1, true)
  showMenu = false
  menuEl.style.display = 'none'
})

let prev = performance.now()

function render(now) {
  resize()
  ensureOffscreen()
  const dt = Math.min(0.05, Math.max(0, (now - prev) * 0.001))
  prev = now
  step(dt)

  // Render scene to offscreen
  gl.bindFramebuffer(gl.FRAMEBUFFER, offFbo)
  gl.clear(gl.COLOR_BUFFER_BIT)
  // Update clear color with palette bg
  gl.clearColor(levelPalette.bg[0], levelPalette.bg[1], levelPalette.bg[2], 1)
  gl.useProgram(program)
  gl.uniform2f(uWorldSize, WORLD_W, WORLD_H)
  gl.bindVertexArray(vao)

  posData.length = 0
  sizeData.length = 0
  colorData.length = 0

  // Bricks
  for (let i = 0; i < bricks.length; i++) {
    const br = bricks[i]
    if (!br.alive) continue
    const hpColor = br.hp === 1 ? levelPalette.brick1 : br.hp === 2 ? levelPalette.brick2 : levelPalette.brick3
    pushInstance(br.x, br.y, br.w, br.h, hpColor[0], hpColor[1], hpColor[2], 1.0)
  }

  // Paddle
  pushInstance(paddleX, paddleY, PADDLE_W, PADDLE_H, levelPalette.paddle[0], levelPalette.paddle[1], levelPalette.paddle[2], 1)

  // Balls
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i]
    pushInstance(b.x, b.y, BALL_SIZE, BALL_SIZE, levelPalette.ball[0], levelPalette.ball[1], levelPalette.ball[2], 1)
  }

  // Powerups
  for (let i = 0; i < powers.length; i++) {
    const p = powers[i]
    pushInstance(p.x, p.y, p.w, p.h, 0.2, 1.0, 0.6, 1)
  }

  drawInstances()
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  // Post-process (bloom)
  gl.useProgram(postProg)
  gl.bindVertexArray(postVao)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, offColor)
  gl.uniform1i(postUTex, 0)
  gl.uniform1f(postUThresh, 0.5)
  gl.uniform1f(postUBloom, 1.1)
  gl.drawArrays(gl.TRIANGLES, 0, 6)

  // HUD
  if (hudEl) hudEl.textContent = `Lvl ${currentLevel}  Lives ${lives}  Balls ${balls.length}  Score ${score}`

  requestAnimationFrame(render)
}

// Input
deviceControls.on('scrollWheel', ({ direction }) => {
  const dir = direction === 'up' ? -1 : 1
  paddleVX += dir * PADDLE_IMPULSE
})
// Mouse/touch fallback (optional)
window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * WORLD_W
  paddleX = x
})

function ensureCanvasCssSize() {
  if (!canvas.style.width) canvas.style.width = '100vw'
  if (!canvas.style.height) canvas.style.height = '100vh'
  canvas.style.display = 'block'
}

ensureCanvasCssSize()
// Start at menu; wait for Start button
    requestAnimationFrame(render)

// Expose minimal debug for tests
window.BB_DEBUG = {
  getStats: () => ({
    paddleX,
    balls: balls.length,
    bricksAlive: bricks.reduce((n, b) => n + (b.alive ? 1 : 0), 0)
  })
}

