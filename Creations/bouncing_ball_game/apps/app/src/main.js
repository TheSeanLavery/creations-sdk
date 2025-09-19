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
  gameStarted: false
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

// Game constants
const GRAVITY = 0.1;
const BOUNCE_IMPULSE = 6.5; // fixed upward velocity on bounce
const HORIZONTAL_SPEED = 3;
const PLATFORM_WIDTH = 60;
const PLATFORM_HEIGHT = 8;
const GROUND_Y = 260;
const SCREEN_WIDTH = 240;
const SCREEN_HEIGHT = 254;
const SCROLL_THRESHOLD = 100; // screenspace Y threshold
const SCROLL_SPEED_MULTIPLIER = 0.2; // scales how fast the camera moves up

// Platform generation
function generatePlatform(y) {
  return {
    x: Math.random() * (SCREEN_WIDTH - PLATFORM_WIDTH),
    y: y,
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
  if (!gameState.isPlaying) return;

  // Apply gravity
  ball.velocityY += GRAVITY;
  
  // Update ball position
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
  
  // Friction - slow down horizontal movement
  ball.velocityX *= 0.98;
  
  // Check if ball moved upward from ground
  if (ball.y < GROUND_Y - 50 && !gameState.gameStarted) {
    gameState.gameStarted = true;
  }
  
  // Update screen scrolling: scale upward movement based on screenspace distance past threshold
  if (gameState.gameStarted) {
    const ballScreenY = ball.y - gameState.screenScrollY;
    if (ballScreenY < SCROLL_THRESHOLD) {
      const overshoot = SCROLL_THRESHOLD - ballScreenY;
      gameState.screenScrollY += overshoot * SCROLL_SPEED_MULTIPLIER;
    }
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
  ctx.translate(0, -gameState.screenScrollY);
  
  // Draw platforms
  platforms.forEach(platform => {
    ctx.fillStyle = platform.color;
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  });
  
  // Draw ball
  ctx.fillStyle = ball.color;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Restore context
  ctx.restore();
  
  // Update score display
  document.getElementById('score').textContent = `Score: ${gameState.score}`;
}

// Game loop
function gameLoop() {
  updatePhysics();
  checkCollisions();
  render();
  
  if (gameState.isPlaying) {
    requestAnimationFrame(gameLoop);
  }
}

// Start game
function startGame() {
  gameState.isPlaying = true;
  gameState.score = 0;
  gameState.highestY = 0;
  gameState.screenScrollY = 0;
  gameState.platformSpeed = 1;
  gameState.gameStarted = false;
  
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
  gameLoop();
}

// Game over
function gameOver() {
  gameState.isPlaying = false;
  
  // Show game over screen
  document.getElementById('finalScore').textContent = gameState.score;
  document.getElementById('gameOver').classList.remove('hidden');
  
  // Visual feedback - flash screen
  canvas.style.filter = 'brightness(1.5)';
  setTimeout(() => {
    canvas.style.filter = 'brightness(1)';
  }, 200);
}

// Handle R1 scroll wheel events for horizontal movement
window.addEventListener('scrollUp', () => {
  if (gameState.isPlaying) {
    ball.velocityX = Math.max(ball.velocityX - HORIZONTAL_SPEED, -HORIZONTAL_SPEED * 2);
  }
});

window.addEventListener('scrollDown', () => {
  if (gameState.isPlaying) {
    ball.velocityX = Math.min(ball.velocityX + HORIZONTAL_SPEED, HORIZONTAL_SPEED * 2);
  }
});

// Handle R1 side button for restart
window.addEventListener('sideClick', () => {
  if (!gameState.isPlaying) {
    startGame();
  }
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
        break;
      case 'ArrowLeft':
        if (gameState.isPlaying) {
          ball.velocityX = Math.max(ball.velocityX - HORIZONTAL_SPEED, -HORIZONTAL_SPEED * 2);
        }
        break;
      case 'ArrowRight':
        if (gameState.isPlaying) {
          ball.velocityX = Math.min(ball.velocityX + HORIZONTAL_SPEED, HORIZONTAL_SPEED * 2);
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
  
  // Add keyboard fallback for development (Space = side button)
  if (typeof PluginMessageHandler === 'undefined') {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('sideClick'));
      }
    });
  }
  
  // Start the game automatically
  startGame();
});

console.log('Bouncing Ball Game Ready!');
console.log('Controls:');
console.log('- Scroll wheel: Move ball left/right');
console.log('- Side button: Restart game');