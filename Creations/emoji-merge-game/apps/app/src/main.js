// Emoji Merge Game for R1 Device
console.log('Emoji Merge Game starting...');

// Check if running as R1 plugin
if (typeof PluginMessageHandler !== 'undefined') {
  console.log('Running as R1 Creation');
} else {
  console.log('Running in browser mode');
}

// Game constants
const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 282;
const GRAVITY = 0.3;
const BOUNCE_DAMPING = 0.7;
const FRICTION = 0.98;
const EMOJI_SIZE = 20;
const MAX_EMOJIS = 50;

// 100 different emojis for the game
const EMOJI_POOL = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
  '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
  '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
  '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
  '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
  '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
  '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
  '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾'
];

// Game state
let canvas, ctx;
let emojis = [];
let maxLevel = 1;
let gameRunning = false;
let lastSpawnTime = 0;
let accelerometerData = { x: 0, y: 0, z: 0 };
let accelerometerRaw = { x: 0, y: 0, z: 0 };
let useAccel = false;


// Device orientation fallback state (for browsers/iOS permissioned gyro)
let tiltX = 0; // front/back in radians
let tiltY = 0; // left/right in radians

// Emoji class
class Emoji {
  constructor(x, y, level, emojiChar) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.level = level;
    this.emoji = emojiChar;
    this.radius = EMOJI_SIZE / 2;
    this.active = true;
    this.canMerge = true;
    this.mergeTimeout = 0;
  }

  update() {
    if (!this.active) return;

    // Apply gyro-based gravity (accelerometer preferred, else deviceorientation fallback)
    if (useAccel) {
      // Map native accel x to horizontal, y to vertical; include base gravity
      this.vx += accelerometerData.x * 0.5;
      this.vy += GRAVITY + (accelerometerData.y * 0.3);
    } else {
      const gx = Math.sin(tiltY);
      const gy = Math.cos(tiltX) - 1.0; // downward bias like gravity
      this.vx += gx * 0.6;
      this.vy += GRAVITY + gy * 0.6;
    }

    // Apply friction
    this.vx *= FRICTION;
    this.vy *= FRICTION;

    // Update position
    this.x += this.vx;
    this.y += this.vy;

    // Bounce off walls (left and right)
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx *= -BOUNCE_DAMPING;
    } else if (this.x + this.radius > CANVAS_WIDTH) {
      this.x = CANVAS_WIDTH - this.radius;
      this.vx *= -BOUNCE_DAMPING;
    }

    // Bounce off bottom
    if (this.y + this.radius > CANVAS_HEIGHT) {
      this.y = CANVAS_HEIGHT - this.radius;
      this.vy *= -BOUNCE_DAMPING;
    }

    // Prevent going off top once on screen
    if (this.y < 0 && this.y < -this.radius) {
      this.y = -this.radius;
      this.vy = Math.max(0, this.vy);
    }

    // Update merge timeout
    if (this.mergeTimeout > 0) {
      this.mergeTimeout--;
      if (this.mergeTimeout <= 0) {
        this.canMerge = true;
      }
    }
  }

  draw() {
    if (!this.active) return;

    ctx.save();
    ctx.font = `${EMOJI_SIZE}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw emoji
    ctx.fillText(this.emoji, this.x, this.y);
    
    // Draw level number
    ctx.font = `${EMOJI_SIZE * 0.4}px Arial`;
    ctx.fillStyle = '#FE5F00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeText(this.level.toString(), this.x, this.y + EMOJI_SIZE * 0.6);
    ctx.fillText(this.level.toString(), this.x, this.y + EMOJI_SIZE * 0.6);
    
    ctx.restore();
  }

  checkCollision(other) {
    if (!this.active || !other.active || this === other) return false;
    
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < (this.radius + other.radius);
  }

  bounce(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return;
    
    const overlap = (this.radius + other.radius) - distance;
    const separationX = (dx / distance) * overlap * 0.5;
    const separationY = (dy / distance) * overlap * 0.5;
    
    this.x += separationX;
    this.y += separationY;
    other.x -= separationX;
    other.y -= separationY;
    
    // Simple velocity exchange
    const tempVx = this.vx;
    const tempVy = this.vy;
    this.vx = other.vx * 0.8;
    this.vy = other.vy * 0.8;
    other.vx = tempVx * 0.8;
    other.vy = tempVy * 0.8;
  }
}

// Object pool for efficient emoji management
class EmojiPool {
  constructor(size) {
    this.pool = [];
    this.activeEmojis = [];
    
    // Pre-create emojis
    for (let i = 0; i < size; i++) {
      this.pool.push(new Emoji(0, 0, 1, EMOJI_POOL[0]));
    }
  }

  get(x, y, level, emojiChar) {
    let emoji;
    if (this.pool.length > 0) {
      emoji = this.pool.pop();
      emoji.x = x;
      emoji.y = y;
      emoji.vx = 0;
      emoji.vy = 0;
      emoji.level = level;
      emoji.emoji = emojiChar;
      emoji.active = true;
      emoji.canMerge = true;
      emoji.mergeTimeout = 0;
    } else {
      emoji = new Emoji(x, y, level, emojiChar);
    }
    
    this.activeEmojis.push(emoji);
    return emoji;
  }

  release(emoji) {
    emoji.active = false;
    const index = this.activeEmojis.indexOf(emoji);
    if (index > -1) {
      this.activeEmojis.splice(index, 1);
      this.pool.push(emoji);
    }
  }

  clear() {
    this.activeEmojis.forEach(emoji => {
      emoji.active = false;
      this.pool.push(emoji);
    });
    this.activeEmojis = [];
  }
}

// Game functions
let emojiPool;

function initGame() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  // Initialize object pool
  emojiPool = new EmojiPool(MAX_EMOJIS);
  
  // Start accelerometer (with availability check and fallback)
  startAccelerometer(60);
  
  gameRunning = true;
  setupPointerControls();
  gameLoop();
}

// ================================
// Multitouch drag + throw (pointer events)
// ================================
const activePointers = new Map(); // pointerId -> { emoji, offsetX, offsetY, lastX, lastY, lastT }

function findEmojiAt(x, y) {
  const list = emojiPool?.activeEmojis || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    const dx = x - e.x;
    const dy = y - e.y;
    if (dx*dx + dy*dy <= e.radius*e.radius) return e;
  }
  return null;
}

function toCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  return { x, y };
}

function setupPointerControls() {
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture?.(ev.pointerId);
    const { x, y } = toCanvasCoords(ev.clientX, ev.clientY);
    const target = findEmojiAt(x, y);
    if (!target) return;
    const entry = {
      emoji: target,
      offsetX: x - target.x,
      offsetY: y - target.y,
      lastX: x,
      lastY: y,
      lastT: performance.now()
    };
    // stop current motion while dragging
    target.vx = 0; target.vy = 0;
    activePointers.set(ev.pointerId, entry);
  });

  canvas.addEventListener('pointermove', (ev) => {
    const entry = activePointers.get(ev.pointerId);
    if (!entry) return;
    const now = performance.now();
    const { x, y } = toCanvasCoords(ev.clientX, ev.clientY);
    // position follows pointer minus grab offset
    const nx = x - entry.offsetX;
    const ny = y - entry.offsetY;
    // constrain inside canvas
    entry.emoji.x = Math.max(entry.emoji.radius, Math.min(CANVAS_WIDTH - entry.emoji.radius, nx));
    entry.emoji.y = Math.max(entry.emoji.radius, Math.min(CANVAS_HEIGHT - entry.emoji.radius, ny));
    // compute velocity for throw
    const dt = Math.max(1, now - entry.lastT) / 1000;
    entry.emoji.vx = (x - entry.lastX) / dt * 0.05; // scale down to reasonable speed
    entry.emoji.vy = (y - entry.lastY) / dt * 0.05;
    entry.lastX = x; entry.lastY = y; entry.lastT = now;
  });

  function endPointer(ev) {
    const entry = activePointers.get(ev.pointerId);
    if (!entry) return;
    // on release, keep velocity for throw; small tweak to avoid sticking
    entry.emoji.canMerge = false;
    entry.emoji.mergeTimeout = Math.max(entry.emoji.mergeTimeout, 10);
    activePointers.delete(ev.pointerId);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
}

function spawnEmoji() {
  if (emojiPool.activeEmojis.length >= MAX_EMOJIS) return;
  
  // Check if top half is clear
  const topHalfClear = !emojiPool.activeEmojis.some(emoji => 
    emoji.active && emoji.y < CANVAS_HEIGHT / 2
  );
  
  if (!topHalfClear) return;
  
  // Determine level (higher levels are rarer)
  let level = 1;
  const rand = Math.random();
  
  if (maxLevel > 1) {
    if (rand < 0.1 && maxLevel > 2) level = maxLevel - 1;
    else if (rand < 0.3 && maxLevel > 1) level = Math.floor(Math.random() * (maxLevel - 1)) + 1;
    else level = Math.floor(Math.random() * Math.min(maxLevel, 3)) + 1;
  }
  
  // Random spawn position
  const x = Math.random() * (CANVAS_WIDTH - EMOJI_SIZE) + EMOJI_SIZE / 2;
  const y = -EMOJI_SIZE;
  
  // Get emoji character based on level
  const emojiIndex = (level - 1) % EMOJI_POOL.length;
  const emojiChar = EMOJI_POOL[emojiIndex];
  
  emojiPool.get(x, y, level, emojiChar);
}

function updatePhysics() {
  const activeEmojis = emojiPool.activeEmojis;
  
  // Update all emojis
  activeEmojis.forEach(emoji => emoji.update());
  
  // Check collisions
  for (let i = 0; i < activeEmojis.length; i++) {
    for (let j = i + 1; j < activeEmojis.length; j++) {
      const emoji1 = activeEmojis[i];
      const emoji2 = activeEmojis[j];
      
      if (emoji1.checkCollision(emoji2)) {
        // Check for merge
        if (emoji1.level === emoji2.level && emoji1.canMerge && emoji2.canMerge) {
          mergeEmojis(emoji1, emoji2);
        } else {
          // Bounce
          emoji1.bounce(emoji2);
        }
      }
    }
  }
}

function mergeEmojis(emoji1, emoji2) {
  // Play pop sound effect
  playPopSound();
  
  // Calculate merge position
  const mergeX = (emoji1.x + emoji2.x) / 2;
  const mergeY = (emoji1.y + emoji2.y) / 2;
  const newLevel = emoji1.level + 1;
  
  // Update max level
  if (newLevel > maxLevel) {
    maxLevel = newLevel;
    updateMaxLevelDisplay();
  }
  
  // Remove old emojis
  emojiPool.release(emoji1);
  emojiPool.release(emoji2);
  
  // Create new emoji
  const emojiIndex = (newLevel - 1) % EMOJI_POOL.length;
  const newEmoji = emojiPool.get(mergeX, mergeY, newLevel, EMOJI_POOL[emojiIndex]);
  
  // Prevent immediate merging
  newEmoji.canMerge = false;
  newEmoji.mergeTimeout = 30; // 30 frames
}

function playPopSound() {
  // Create a simple pop sound using Web Audio API
  if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
    try {
      const audioContext = new (AudioContext || webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      console.log('Audio context not available');
    }
  }
}

function updateMaxLevelDisplay() {
  const display = document.getElementById('max-level-display');
  if (display) {
    display.textContent = `Max: ${maxLevel}`;
  }
}

function render() {
  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Draw all emojis
  emojiPool.activeEmojis.forEach(emoji => emoji.draw());

  // Update gyro debug overlay
  try {
    const el = document.getElementById('gyro-overlay');
    if (el) {
      // Show raw emulator-like values when accel active, else derived tilt
      const x = useAccel ? accelerometerRaw.x : Math.sin(tiltY);
      const y = useAccel ? accelerometerRaw.y : Math.sin(tiltX); // show tilt not bias for overlay
      const z = useAccel ? accelerometerRaw.z : 0;
      el.textContent = `x: ${x.toFixed(2)}\ny: ${y.toFixed(2)}\nz: ${z.toFixed(2)}`;
    }
  } catch {}
}

function gameLoop() {
  if (!gameRunning) return;
  
  // Spawn emoji occasionally
  const now = Date.now();
  if (now - lastSpawnTime > 2000) { // Every 2 seconds
    spawnEmoji();
    lastSpawnTime = now;
  }
  
  updatePhysics();
  render();
  
  requestAnimationFrame(gameLoop);
}

// ===========================================
// Accelerometer Access (Modified for Game)
// ===========================================

let accelerometerRunning = false;

function startAccelerometer(frequency = 60) {
  let acc = window?.creationSensors?.accelerometer;

  const tryStart = () => {
    try {
      const sensor = acc || window?.creationSensors?.accelerometer;
      if (!sensor || typeof sensor.start !== 'function') return false;
      sensor.start((data) => {
        // Normalize and axis map similar to DiceSim: keep X, flip Y/Z to match downwards
        const tx0 = (typeof data.tiltX === 'number') ? data.tiltX : (typeof data.x === 'number' ? data.x : 0);
        const ty0 = (typeof data.tiltY === 'number') ? data.tiltY : (typeof data.y === 'number' ? data.y : -1);
        const tz0 = (typeof data.tiltZ === 'number') ? data.tiltZ : (typeof data.z === 'number' ? data.z : 0);
        // Save raw values for debug overlay (match emulator sliders)
        accelerometerRaw = { x: tx0, y: ty0, z: tz0 };
        const tx = tx0;
        const ty = -ty0;
        const tz = -tz0;
        accelerometerData = { x: tx, y: ty, z: tz };
        useAccel = true;
      }, { frequency });
      accelerometerRunning = true;
      console.log('Accelerometer started');
      return true;
    } catch (e) {
      console.error('Error starting accelerometer:', e);
      return false;
    }
  };

  if (!acc) {
    console.log('Accelerometer API not available - using fallback, will retry');
    setupDeviceOrientationFallback();
    // Retry until shim/native appears
    let tries = 0;
    const maxTries = 40;
    const t = setInterval(() => {
      if (useAccel || accelerometerRunning) { clearInterval(t); return; }
      acc = window?.creationSensors?.accelerometer;
      if (acc) {
        if (acc && typeof acc.isAvailable === 'function') {
          acc.isAvailable().then((ok) => { if (ok && tryStart()) clearInterval(t); }).catch(() => {});
        } else if (tryStart()) {
          clearInterval(t);
        }
      }
      tries++;
      if (tries >= maxTries) clearInterval(t);
    }, 300);
  }
  try {
    if (acc && typeof acc.isAvailable === 'function') {
      acc.isAvailable().then((ok) => {
        if (ok) {
          if (!tryStart()) setupDeviceOrientationFallback();
        } else {
          setupDeviceOrientationFallback();
        }
      }).catch(() => { if (!tryStart()) setupDeviceOrientationFallback(); });
    } else {
      if (!tryStart()) setupDeviceOrientationFallback();
    }
    // Also retry in case accel was present but failed to start for timing
    let tries = 0;
    const maxTries = 20;
    const t2 = setInterval(() => {
      if (useAccel || accelerometerRunning) { clearInterval(t2); return; }
      if (tryStart()) clearInterval(t2);
      tries++;
      if (tries >= maxTries) clearInterval(t2);
    }, 300);
  } catch (e) {
    console.error('Accelerometer init error:', e);
    setupDeviceOrientationFallback();
  }
  return true;
}

function stopAccelerometer() {
  if (window.creationSensors && window.creationSensors.accelerometer && accelerometerRunning) {
    try {
      window.creationSensors.accelerometer.stop();
      accelerometerRunning = false;
      console.log('Accelerometer stopped');
    } catch (e) {
      console.error('Error stopping accelerometer:', e);
    }
  }
}

// -------------------------------------------
// DeviceOrientation Fallback (browser/ios)
// -------------------------------------------
function setupDeviceOrientationFallback() {
  try {
    const onOrient = (ev) => {
      const beta = (ev.beta || 0) * Math.PI / 180; // front-back
      const gamma = (ev.gamma || 0) * Math.PI / 180; // left-right
      tiltX = Math.max(-Math.PI/2, Math.min(Math.PI/2, beta));
      tiltY = Math.max(-Math.PI/2, Math.min(Math.PI/2, gamma));
    };
    const anyDO = window.DeviceOrientationEvent;
    if (anyDO && anyDO.requestPermission) {
      // Request on first user interaction
      document.body.addEventListener('click', async () => {
        try { const p = await anyDO.requestPermission(); if (p === 'granted') window.addEventListener('deviceorientation', onOrient); } catch {}
      }, { once: true });
    } else if (anyDO) {
      window.addEventListener('deviceorientation', onOrient);
    }
    console.log('Using deviceorientation fallback');
  } catch {}
}

// ===========================================
// Hardware Event Handlers
// ===========================================

// Handle R1 scroll wheel events - spawn emoji when scrolled
window.addEventListener('scrollUp', () => {
  console.log('Scroll up detected - spawning emoji');
  spawnEmoji();
});

window.addEventListener('scrollDown', () => {
  console.log('Scroll down detected - spawning emoji');
  spawnEmoji();
});

// Handle R1 side button - restart game
window.addEventListener('sideClick', () => {
  console.log('Side button clicked - restarting game');
  restartGame();
});

function restartGame() {
  if (emojiPool) {
    emojiPool.clear();
  }
  maxLevel = 1;
  updateMaxLevelDisplay();
  lastSpawnTime = 0;
}

// ===========================================
// Initialization
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('Emoji Merge Game initialized!');
  
  // Add keyboard fallback for development
  if (typeof PluginMessageHandler === 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('sideClick'));
      }
      if (event.code === 'ArrowUp') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('scrollUp'));
      }
      if (event.code === 'ArrowDown') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('scrollDown'));
      }
    });
  }
  
  // Initialize the game
  initGame();
});

console.log('Emoji Merge Game Ready!');
console.log('Controls:');
console.log('- Side button: Restart game');
console.log('- Scroll wheel: Spawn emoji');
console.log('- Gyro: Controls gravity direction');