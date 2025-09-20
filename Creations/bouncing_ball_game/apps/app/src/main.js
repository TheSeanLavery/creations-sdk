// Bouncing Ball Game for R1 Device
// Screen: 240x282 pixels (portrait)

// Check if running as R1 plugin
if (typeof PluginMessageHandler !== 'undefined') {
  console.log('Running as R1 Creation');
} else {
  console.log('Running in browser mode');
}

// Game state
let gameState = {
  isPlaying: false,
  isPaused: false,
  score: 0,
  highestY: 0,
  screenScrollY: 0,
  platformSpeed: 1,
  gameStarted: false,
  musicMuted: false,
  sfxMuted: false,
  highScore: 0,
  isNewHighScore: false
};

// Game objects
let ball = {
  x: 120, // Center of screen (240/2)
  y: 200, // Start near bottom
  radius: 8,
  velocityX: 0,
  velocityY: 0,
  onGround: true,
  color: '#FE5F00'
};

let platforms = [];
let canvas, ctx;
let startingPlatform = null;
let backgroundMusic = null;
let hasTriedStartMusic = false;
let ballImage = null;
let ballImageLoaded = false;
let previousBallX = 0;
let previousBallY = 0;
let previousScreenScrollY = 0;

// Game constants
const GRAVITY = 0.1;
const BOUNCE_IMPULSE = 6.5; // fixed upward velocity on bounce
// Horizontal motion parameters (velocity-based control)
const HORIZONTAL_ACCEL = 0.8;           // amount added to velocity per scroll/press
const MAX_HORIZONTAL_SPEED = 6;         // cap absolute horizontal speed
const GROUND_FRICTION = 0.85;           // stronger friction when ball is grounded
const AIR_DRAG = 0.98;                  // gentle drag while airborne
const PLATFORM_WIDTH = 60;
const PLATFORM_HEIGHT = 8;
const GROUND_Y = 260;
const SCREEN_WIDTH = 240;
const SCREEN_HEIGHT = 254;
const SCROLL_THRESHOLD = 100; // screenspace Y threshold
const SCROLL_SPEED_MULTIPLIER = -0.1; // scales how fast the camera moves up

// Fixed timestep loop (60 Hz physics)
const FIXED_TIMESTEP_MS = 1000 / 60;
let accumulatorMs = 0;
let lastTimestamp = 0;
let loopActive = false;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function startMainLoop() {
  if (loopActive) return;
  loopActive = true;
  lastTimestamp = performance.now();
  accumulatorMs = 0;
  setTimeout(runMainLoop, 0);
}

function stopMainLoop() {
  loopActive = false;
}

function runMainLoop() {
  if (!loopActive) return;
  const now = performance.now();
  let frameTime = now - lastTimestamp;
  if (frameTime > 100) frameTime = 100; // clamp to avoid spiral of death
  lastTimestamp = now;
  accumulatorMs += frameTime;

  while (accumulatorMs >= FIXED_TIMESTEP_MS) {
    updatePhysics();
    checkCollisions();
    accumulatorMs -= FIXED_TIMESTEP_MS;
  }

  render();

  if (gameState.isPlaying) {
    setTimeout(runMainLoop, 0); // decoupled from vsync
  } else {
    loopActive = false;
  }
}

// Platform generation
function generatePlatform(y) {
  return {
    x: Math.random() * (SCREEN_WIDTH - PLATFORM_WIDTH),
    y: y,
    prevY: y,
    width: PLATFORM_WIDTH,
    height: PLATFORM_HEIGHT,
    color: '#fff'
  };
}

// Initialize platforms
function initializePlatforms() {
  platforms = [];
  // Create ground platform
  platforms.push({
    x: 0,
    y: GROUND_Y,
    prevY: GROUND_Y,
    width: SCREEN_WIDTH,
    height: PLATFORM_HEIGHT,
    color: '#fff',
    isGround: true
  });
  
  // Create starting platform higher than ground
  const startY = GROUND_Y - 60;
  startingPlatform = {
    x: Math.floor((SCREEN_WIDTH - PLATFORM_WIDTH) / 2),
    y: startY,
    prevY: startY,
    width: PLATFORM_WIDTH,
    height: PLATFORM_HEIGHT,
    color: '#fff',
    isStart: true
  };
  platforms.push(startingPlatform);
  
  // Generate platforms going upward from the starting platform
  for (let i = 1; i <= 20; i++) {
    platforms.push(generatePlatform(startY - (i * 80)));
  }
}

// Physics update
function updatePhysics() {
  if (!gameState.isPlaying || gameState.isPaused) return;

  // Apply gravity
  ball.velocityY += GRAVITY;
  
  // Update ball position
  previousBallX = ball.x;
  previousBallY = ball.y;
  ball.x += ball.velocityX;
  ball.y += ball.velocityY;
  
  // Horizontal boundaries
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.velocityX = 0;
  } else if (ball.x + ball.radius > SCREEN_WIDTH) {
    ball.x = SCREEN_WIDTH - ball.radius;
    ball.velocityX = 0;
  }
  
  // Friction/drag - slow horizontal velocity depending on last frame's grounded state
  ball.velocityX *= (ball.onGround ? GROUND_FRICTION : AIR_DRAG);
  if (Math.abs(ball.velocityX) < 0.01) ball.velocityX = 0;
  
  // Check if ball moved upward from ground
  if (ball.y < GROUND_Y - 50 && !gameState.gameStarted) {
    gameState.gameStarted = true;
  }
  
  // Update camera in world space: follow target = ball.y - SCROLL_THRESHOLD
  if (gameState.gameStarted) {
    const desiredScrollY = ball.y - SCROLL_THRESHOLD;
    const isMovingUp = ball.velocityY < 0;
    const baseFollow = 0.12; // smooth follow baseline per physics step
    const velocityBoost = Math.min(0.25, Math.max(0, -ball.velocityY) * 0.02); // boost when going up
    const followFactor = Math.min(0.45, baseFollow + (isMovingUp ? velocityBoost : 0));
    previousScreenScrollY = gameState.screenScrollY;
    let nextScroll = lerp(gameState.screenScrollY, desiredScrollY, followFactor);
    // Prevent camera from moving downward (only allow upward progress)
    if (nextScroll > gameState.screenScrollY) {
      nextScroll = gameState.screenScrollY;
    }
    gameState.screenScrollY = nextScroll;
  }
  
  // Update score based on highest point reached
  const currentHeight = Math.max(0, GROUND_Y - ball.y);
  if (currentHeight > gameState.highestY) {
    gameState.highestY = currentHeight;
    gameState.score = Math.floor(gameState.highestY / 10);
  }
  
  // Increase platform speed over time
  gameState.platformSpeed = .2 + (gameState.score * 0.01);
  
  // Move platforms down
  platforms.forEach(platform => {
    platform.prevY = platform.y;
    platform.y += gameState.platformSpeed;
  });
  
  // Remove platforms that are too far down and add new ones at the top
  platforms = platforms.filter(platform => platform.y < gameState.screenScrollY + SCREEN_HEIGHT + 100);
  
  // Add new platforms at the top
  while (platforms.length < 25) {
    const highestPlatform = Math.min(...platforms.map(p => p.y));
    platforms.push(generatePlatform(highestPlatform - 80));
  }
  
  // Game over check - ball falls below screen
  if (ball.y > gameState.screenScrollY + SCREEN_HEIGHT + 50) {
    gameOver();
  }
}

// Collision detection
function checkCollisions() {
  if (!gameState.isPlaying || gameState.isPaused) return;
  ball.onGround = false;
  
  platforms.forEach(platform => {
    // Check if ball is colliding with platform
    if (ball.x + ball.radius > platform.x && 
        ball.x - ball.radius < platform.x + platform.width &&
        ball.y + ball.radius > platform.y && 
        ball.y - ball.radius < platform.y + platform.height) {
      
      // Ball is above platform and moving down
      if (ball.velocityY > 0 && ball.y < platform.y) {
        ball.y = platform.y - ball.radius;
        // Apply fixed upward bounce impulse
        ball.velocityY = -BOUNCE_IMPULSE;
        ball.onGround = true;
        
        // Play landing sound effect (visual feedback)
        platform.color = '#FE5F00';
        setTimeout(() => {
          platform.color = '#fff';
        }, 100);
      }
    }
  });
}

// Render game
function render() {
  // Clear canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  
  // Save context for scrolling
  ctx.save();
  // Interpolate scroll for smoother visuals
  const alpha = Math.min(1, accumulatorMs / FIXED_TIMESTEP_MS);
  const interpolatedScrollY = lerp(previousScreenScrollY, gameState.screenScrollY, alpha || 0);
  ctx.translate(0, -interpolatedScrollY);
  
  // Draw platforms
  platforms.forEach(platform => {
    const interpY = lerp(platform.prevY, platform.y, alpha || 0);
    ctx.fillStyle = platform.color;
    ctx.fillRect(platform.x, interpY, platform.width, platform.height);
  });
  
  // Draw ball
  const diameter = ball.radius * 2;
  const drawBallX = lerp(previousBallX, ball.x, alpha || 0);
  const drawBallY = lerp(previousBallY, ball.y, alpha || 0);
  if (ballImageLoaded && ballImage) {
    const drawX = Math.round(drawBallX - ball.radius);
    const drawY = Math.round(drawBallY - ball.radius);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(ballImage, drawX, drawY, diameter, diameter);
  } else {
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(drawBallX, drawBallY, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Restore context
  ctx.restore();
  
  // Update score display
  document.getElementById('score').textContent = `Score: ${gameState.score}`;
  const hs = document.getElementById('highScore');
  if (hs) hs.textContent = `Top: ${gameState.highScore}`;
}

// Game loop
// gameLoop replaced by startMainLoop/runMainLoop

// Start game
function startGame() {
  gameState.isPlaying = true;
  gameState.score = 0;
  gameState.highestY = 0;
  gameState.screenScrollY = 0;
  gameState.platformSpeed = 1;
  gameState.gameStarted = false;
  gameState.isNewHighScore = false;
  // Hide banner if visible
  const banner = document.getElementById('newHighScoreBanner');
  if (banner) banner.classList.add('hidden');
  
  // Initialize platforms first
  initializePlatforms();
  
  // Reset ball and place it on top of the starting platform
  ball.velocityX = 0;
  ball.velocityY = 0;
  ball.onGround = true;
  if (startingPlatform) {
    ball.x = startingPlatform.x + (startingPlatform.width / 2);
    ball.y = startingPlatform.y - ball.radius;
  } else {
    // Fallback to center if starting platform missing
    ball.x = 120;
    ball.y = 200;
  }
  
  // Hide game over screen
  document.getElementById('gameOver').classList.add('hidden');
  
  // Start game loop
  startMainLoop();
}

// Game over
function gameOver() {
  gameState.isPlaying = false;
  
  // Show game over screen
  document.getElementById('finalScore').textContent = gameState.score;
  document.getElementById('gameOver').classList.remove('hidden');
  
  // Check and persist high score
  const previousHigh = gameState.highScore;
  if (gameState.score > previousHigh) {
    gameState.highScore = gameState.score;
    gameState.isNewHighScore = true;
    try {
      localStorage.setItem('bbg_highScore', String(gameState.highScore));
    } catch (e) {}
  }
  
  // Update high score UI
  const hs = document.getElementById('highScore');
  if (hs) hs.textContent = `Top: ${gameState.highScore}`;
  
  // Flash gold/white for 4 seconds if new high score
  if (gameState.isNewHighScore) {
    const finalScoreEl = document.getElementById('finalScore');
    if (finalScoreEl) finalScoreEl.classList.add('flash-gold');
    if (hs) hs.classList.add('flash-gold');
    const banner = document.getElementById('newHighScoreBanner');
    if (banner) banner.classList.remove('hidden');
    setTimeout(() => {
      if (finalScoreEl) finalScoreEl.classList.remove('flash-gold');
      if (hs) hs.classList.remove('flash-gold');
      if (banner) banner.classList.add('hidden');
    }, 4000);
  }
  
  // Visual feedback - flash screen
  canvas.style.filter = 'brightness(1.5)';
  setTimeout(() => {
    canvas.style.filter = 'brightness(1)';
  }, 200);
}

// Handle R1 scroll wheel events for horizontal movement
window.addEventListener('scrollUp', () => {
  if (gameState.isPlaying) {
    ball.velocityX = Math.max(ball.velocityX - HORIZONTAL_ACCEL, -MAX_HORIZONTAL_SPEED);
  }
});

window.addEventListener('scrollDown', () => {
  if (gameState.isPlaying) {
    ball.velocityX = Math.min(ball.velocityX + HORIZONTAL_ACCEL, MAX_HORIZONTAL_SPEED);
  }
});

// Handle R1 side button for restart
window.addEventListener('sideClick', () => {
  if (!gameState.isPlaying) {
    startGame();
  }
  // Attempt to start music on a user gesture
  tryStartBackgroundMusic();
});

// Keyboard fallback for development
document.addEventListener('keydown', (event) => {
  if (typeof PluginMessageHandler === 'undefined') {
    switch(event.key) {
      case ' ':
        event.preventDefault();
        if (!gameState.isPlaying) {
          startGame();
        }
        tryStartBackgroundMusic();
        break;
      case 'ArrowLeft':
        if (gameState.isPlaying) {
          ball.velocityX = Math.max(ball.velocityX - HORIZONTAL_ACCEL, -MAX_HORIZONTAL_SPEED);
        }
        break;
      case 'ArrowRight':
        if (gameState.isPlaying) {
          ball.velocityX = Math.min(ball.velocityX + HORIZONTAL_ACCEL, MAX_HORIZONTAL_SPEED);
        }
        break;
    }
  }
});

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
  console.log('Bouncing Ball Game initialized!');
  
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  
  // Set canvas size to match R1 screen
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;

  // Load ball sprite image
  try {
    const spriteUrl = new URL('./bun.png', import.meta.url).href;
    ballImage = new Image();
    ballImage.src = spriteUrl;
    ballImage.onload = () => {
      ballImageLoaded = true;
    };
  } catch (e) {
    console.warn('Failed to load ball sprite', e);
  }

  // Setup settings UI
  const settingsButton = document.getElementById('settingsButton');
  const settingsMenu = document.getElementById('settingsMenu');
  const musicToggle = document.getElementById('musicMuteToggle');
  const sfxToggle = document.getElementById('sfxMuteToggle');

  if (settingsButton && settingsMenu) {
    settingsButton.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsMenu.classList.toggle('hidden');
      const isOpen = !settingsMenu.classList.contains('hidden');
      if (isOpen) {
        // Pause only if currently playing
        if (gameState.isPlaying) {
          gameState.isPaused = true;
        }
      } else {
        // Resume if it was paused by the menu
        if (gameState.isPaused) {
          gameState.isPaused = false;
          // Reset loop timestamp to avoid large catch-up
          lastTimestamp = performance.now();
        }
      }
    });
    document.addEventListener('click', (e) => {
      if (!settingsMenu.classList.contains('hidden')) {
        // Close if clicking outside the menu
        if (!settingsMenu.contains(e.target) && e.target !== settingsButton) {
          settingsMenu.classList.add('hidden');
          if (gameState.isPaused) {
            gameState.isPaused = false;
            lastTimestamp = performance.now();
          }
        }
      }
    });
  }

  // Load persisted audio prefs
  try {
    const savedMusicMuted = localStorage.getItem('bbg_musicMuted');
    const savedSfxMuted = localStorage.getItem('bbg_sfxMuted');
    if (savedMusicMuted !== null) gameState.musicMuted = savedMusicMuted === 'true';
    if (savedSfxMuted !== null) gameState.sfxMuted = savedSfxMuted === 'true';
    const savedHighScore = localStorage.getItem('bbg_highScore');
    if (savedHighScore !== null) gameState.highScore = parseInt(savedHighScore, 10) || 0;
  } catch (err) {
    // ignore storage errors
  }

  if (musicToggle) {
    musicToggle.checked = gameState.musicMuted;
    musicToggle.addEventListener('change', () => {
      gameState.musicMuted = musicToggle.checked;
      persistAudioPrefs();
      updateMusicState();
    });
  }

  if (sfxToggle) {
    sfxToggle.checked = gameState.sfxMuted;
    sfxToggle.addEventListener('change', () => {
      gameState.sfxMuted = sfxToggle.checked;
      persistAudioPrefs();
    });
  }

  // Prepare background music element
  initBackgroundMusic();
  
  // Add keyboard fallback for development (Space = side button)
  if (typeof PluginMessageHandler === 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('sideClick'));
      }
    });
    // Also try to start music on generic user interactions in browser
    ['pointerdown', 'touchstart', 'click'].forEach((evt) => {
      window.addEventListener(evt, tryStartBackgroundMusic, { once: true });
    });
  }
  
  // Start the game automatically
  startGame();
  // Try to start music (may be blocked until gesture)
  tryStartBackgroundMusic();
});

console.log('Bouncing Ball Game Ready!');
console.log('Controls:');
console.log('- Scroll wheel: Move ball left/right');
console.log('- Side button: Restart game');

// ----------------------
// Audio helpers
// ----------------------
function initBackgroundMusic() {
  if (backgroundMusic) return;
  try {
    const musicUrl = new URL('./banger1.mp3', import.meta.url).href;
    backgroundMusic = new Audio(musicUrl);
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.4;
    backgroundMusic.muted = !!gameState.musicMuted;
  } catch (e) {
    console.warn('Failed to initialize background music', e);
  }
}

function tryStartBackgroundMusic() {
  if (!backgroundMusic) initBackgroundMusic();
  if (!backgroundMusic || hasTriedStartMusic) return;
  hasTriedStartMusic = true;
  if (gameState.musicMuted) return;
  const playPromise = backgroundMusic.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise.catch(() => {
      // Autoplay blocked; allow another try on next gesture
      hasTriedStartMusic = false;
    });
  }
}

function updateMusicState() {
  if (!backgroundMusic) return;
  backgroundMusic.muted = !!gameState.musicMuted;
  if (gameState.musicMuted) {
    backgroundMusic.pause();
  } else {
    // Attempt to play if unmuted
    hasTriedStartMusic = false;
    tryStartBackgroundMusic();
  }
}

function persistAudioPrefs() {
  try {
    localStorage.setItem('bbg_musicMuted', String(!!gameState.musicMuted));
    localStorage.setItem('bbg_sfxMuted', String(!!gameState.sfxMuted));
  } catch (err) {
    // ignore
  }
}