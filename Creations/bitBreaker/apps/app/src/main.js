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
layout(location=3) in vec4 a_color;     // base color
layout(location=4) in vec2 a_params;    // x: seed, y: damage [0,1]
uniform vec2 u_worldSize;
out vec4 v_color;
out vec2 v_uv;        // local 0..1
out vec2 v_params;    // seed, damage
void main(){
  vec2 world = a_instPos + a_pos * a_instSize;
  vec2 ndc = (world / u_worldSize) * 2.0 - 1.0;
  ndc.y = -ndc.y; // flip Y to screen coords
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_color = a_color;
  v_uv = a_pos * 0.5 + 0.5;
  v_params = a_params;
}`

const fs2d = `#version 300 es
precision highp float;
in vec4 v_color;
in vec2 v_uv;
in vec2 v_params; // seed, damage
out vec4 outColor;

// Hash helpers
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
vec2 hash21(float p) {
  float n = hash11(p);
  return vec2(hash11(n + 1.2345), hash11(n + 6.5432));
}

// Simple Voronoi crack mask using F2-F1 metric
float crackMask(vec2 uv, float seed, float damage) {
  // cell count scales with damage (more cracks over time)
  float cells = mix(6.0, 18.0, clamp(damage, 0.0, 1.0));
  vec2 p = uv * cells;
  vec2 pi = floor(p);
  vec2 pf = fract(p);
  float f1 = 1e9, f2 = 1e9;
  for (int j=-1;j<=1;j++){
    for (int i=-1;i<=1;i++){
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash21(dot(pi+g, vec2(127.1,311.7))+seed*91.7) - 0.5;
      vec2 d = g + o + 0.5 - pf;
      float dist = dot(d,d);
      if (dist < f1) { f2 = f1; f1 = dist; }
      else if (dist < f2) { f2 = dist; }
    }
  }
  float edge = abs(f2 - f1);
  float thickness = mix(0.01, 0.08, damage);
  float m = smoothstep(thickness, thickness*0.5, edge);
  return m;
}

void main(){
  float seed = v_params.x;
  float damage = clamp(v_params.y, 0.0, 1.0);
  float cracks = crackMask(clamp(v_uv, 0.0, 1.0), seed, damage);
  vec3 base = v_color.rgb;
  vec3 crackCol = vec3(0.02,0.02,0.02);
  vec3 col = mix(base, crackCol, cracks);
  outColor = vec4(col, 1.0);
}`

const program = createProgram(gl, vs2d, fs2d)
gl.useProgram(program)

// Bloom pipeline: scene -> offColor, horizontal bright blur -> offBlurTex, vertical blur + composite to screen
const offColor = gl.createTexture()
const offFbo = gl.createFramebuffer()
const offBlurTex = gl.createTexture()
const offBlurFbo = gl.createFramebuffer()
let offW = 0, offH = 0
function configureTexture(tex, w, h) {
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
}
function ensureOffscreen() {
  if (offW === canvas.width && offH === canvas.height) return
  offW = canvas.width; offH = canvas.height
  configureTexture(offColor, offW, offH)
  gl.bindFramebuffer(gl.FRAMEBUFFER, offFbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, offColor, 0)
  configureTexture(offBlurTex, offW, offH)
  gl.bindFramebuffer(gl.FRAMEBUFFER, offBlurFbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, offBlurTex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

const vsPost = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

// Horizontal/vertical blur with optional bright threshold
const fsBlur = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_dir;       // (1,0) or (0,1)
uniform float u_threshold; // >=0 to apply bright-pass; <0 to skip
void main(){
  vec2 texel = 1.0 / vec2(textureSize(u_tex, 0));
  float w[9];
  w[0]=0.05; w[1]=0.07; w[2]=0.1; w[3]=0.13; w[4]=0.2; w[5]=0.13; w[6]=0.1; w[7]=0.07; w[8]=0.05;
  vec3 sum = vec3(0.0);
  int k = 0;
  for (int i=-4;i<=4;i++){
    vec2 uv = v_uv + float(i) * texel * u_dir * 2.0; // widen radius
    vec3 s = texture(u_tex, uv).rgb;
    if (u_threshold >= 0.0) {
      float b = max(0.0, max(max(s.r, s.g), s.b) - u_threshold);
      s *= b;
    }
    sum += s * w[k++];
  }
  outColor = vec4(sum, 1.0);
}`

// Composite blurred brightness with original scene
const fsComposite = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_scene;
uniform sampler2D u_blur;
uniform float u_bloom;
void main(){
  vec3 scene = texture(u_scene, v_uv).rgb;
  vec3 blur = texture(u_blur, v_uv).rgb;
  outColor = vec4(scene + blur * u_bloom, 1.0);
}`

const blurProg = createProgram(gl, vsPost, fsBlur)
const blurUTex = gl.getUniformLocation(blurProg, 'u_tex')
const blurUDir = gl.getUniformLocation(blurProg, 'u_dir')
const blurUThresh = gl.getUniformLocation(blurProg, 'u_threshold')

const compProg = createProgram(gl, vsPost, fsComposite)
const compUScene = gl.getUniformLocation(compProg, 'u_scene')
const compUBlur = gl.getUniformLocation(compProg, 'u_blur')
const compUBloom = gl.getUniformLocation(compProg, 'u_bloom')

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
const instParamBuf = gl.createBuffer()

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

gl.bindBuffer(gl.ARRAY_BUFFER, instParamBuf)
gl.enableVertexAttribArray(4)
gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 0, 0)
gl.vertexAttribDivisor(4, 1)

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
  // Coarser maze grid to produce longer continuous walls
  const mazeCols = 16, mazeRows = 10
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
const paramData = []

function pushInstance(x, y, w, h, r, g, b, a, seed = 0, damage = 0) {
  posData.push(x, y)
  sizeData.push(w, h)
  colorData.push(r, g, b, a)
  paramData.push(seed, damage)
}

function drawInstances() {
  const pos = new Float32Array(posData)
  const size = new Float32Array(sizeData)
  const col = new Float32Array(colorData)
  const par = new Float32Array(paramData)
  gl.bindBuffer(gl.ARRAY_BUFFER, instPosBuf)
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, instSizeBuf)
  gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, instColorBuf)
  gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, instParamBuf)
  gl.bufferData(gl.ARRAY_BUFFER, par, gl.DYNAMIC_DRAW)
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
let gameRunning = false
let score = 0
startBtn?.addEventListener('click', () => {
  baseSeed = parseInt(seedInput?.value || '12345', 10) || 12345
  loadLevel(1, true)
  showMenu = false
  menuEl.style.display = 'none'
  const cvs = document.getElementById('glcanvas'); if (cvs) cvs.style.visibility = 'visible'
  if (!gameRunning) { gameRunning = true; requestAnimationFrame(render) }
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
    const damage = 1.0 - Math.max(0.0, Math.min(1.0, br.hp / 3.0))
    pushInstance(br.x, br.y, br.w, br.h, hpColor[0], hpColor[1], hpColor[2], 1.0, (i * 13.37) % 1000, damage)
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
  // Horizontal blur with bright-pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, offBlurFbo)
  gl.useProgram(blurProg)
  gl.bindVertexArray(postVao)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, offColor)
  gl.uniform1i(blurUTex, 0)
  gl.uniform2f(blurUDir, 1, 0)
  gl.uniform1f(blurUThresh, 0.3)
  gl.drawArrays(gl.TRIANGLES, 0, 6)

  // Vertical blur
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.useProgram(compProg)
  gl.bindVertexArray(postVao)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, offColor)
  gl.uniform1i(compUScene, 0)
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, offBlurTex)
  gl.uniform1i(compUBlur, 1)
  gl.uniform1f(compUBloom, 4.0)
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
// Start at menu; do not run until Start pressed

// Expose minimal debug for tests
window.BB_DEBUG = {
  getStats: () => ({
    paddleX,
    balls: balls.length,
    bricksAlive: bricks.reduce((n, b) => n + (b.alive ? 1 : 0), 0)
  })
}

