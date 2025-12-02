// Snake Game - Multiplayer!
// Each player controls their own snake. Eat food to grow, don't hit walls or other snakes!

class SnakeGame extends GameEngine {
  gridSize = 20; // Class field - initialized before constructor runs

  constructor(canvas, connectionManager) {
    super(canvas, connectionManager);

    this.snakes = {}; // player id -> snake object
    this.food = [];
    this.baseGameSpeed = 100; // ms between moves at full speed
    this.slowGameSpeed = 250; // ms between moves when learning
    this.gameSpeed = this.slowGameSpeed; // Start slow
    this.lastMoveTime = 0;
    this.gameStartTime = null; // Set when first player starts moving
    this.learningPeriod = 5000; // 5 seconds learning period per player

    // Game area (set in resize)
    this.gridWidth = 0;
    this.gridHeight = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.gameOver = false;
    this.winner = null;

    // Explosion particles
    this.explosions = [];
    this.explosionDuration = 800; // ms

    this.resize();
    this.spawnFood();
    this.spawnFood();
    this.spawnFood();
  }

  resize() {
    super.resize();

    // Skip if gridSize not ready yet (parent constructor calling resize)
    if (!this.gridSize) return;

    // Calculate grid dimensions
    this.gridWidth = Math.floor(this.width / this.gridSize);
    this.gridHeight = Math.floor(this.height / this.gridSize);

    // Center the grid
    this.offsetX = (this.width - this.gridWidth * this.gridSize) / 2;
    this.offsetY = (this.height - this.gridHeight * this.gridSize) / 2;
  }

  spawnFood() {
    // Find empty cell
    let x, y;
    let attempts = 0;
    do {
      x = Math.floor(Math.random() * (this.gridWidth - 4)) + 2;
      y = Math.floor(Math.random() * (this.gridHeight - 4)) + 2;
      attempts++;
    } while (this.isCellOccupied(x, y) && attempts < 100);

    if (attempts < 100) {
      this.food.push({ x, y });
    }
  }

  isCellOccupied(x, y) {
    // Check snakes
    for (const snake of Object.values(this.snakes)) {
      if (snake.dead) continue;
      for (const segment of snake.body) {
        if (segment.x === x && segment.y === y) return true;
      }
    }
    // Check food
    for (const f of this.food) {
      if (f.x === x && f.y === y) return true;
    }
    return false;
  }

  isSpawnAreaOccupied(x, y) {
    // Check if spawn area (3x3 around spawn point) overlaps any snake
    for (const snake of Object.values(this.snakes)) {
      for (const segment of snake.body) {
        if (Math.abs(segment.x - x) <= 3 && Math.abs(segment.y - y) <= 3) {
          return true;
        }
      }
    }
    return false;
  }

  onPlayerJoin(player) {
    // Spawn snake at random position (safely within bounds)
    const safeWidth = Math.max(10, this.gridWidth);
    const safeHeight = Math.max(10, this.gridHeight);

    // Try to find a spawn position that doesn't overlap other snakes
    let startX, startY, attempts = 0;
    do {
      startX = Math.floor(Math.random() * (safeWidth - 10)) + 5;
      startY = Math.floor(Math.random() * (safeHeight - 10)) + 5;
      attempts++;
    } while (this.isSpawnAreaOccupied(startX, startY) && attempts < 50);

    // Random starting direction
    const directions = ['up', 'down', 'left', 'right'];
    const dir = directions[Math.floor(Math.random() * 4)];

    this.snakes[player.id] = {
      player,
      body: [
        { x: startX, y: startY },
        { x: startX - (dir === 'right' ? -1 : dir === 'left' ? 1 : 0),
          y: startY - (dir === 'down' ? -1 : dir === 'up' ? 1 : 0) },
        { x: startX - (dir === 'right' ? -2 : dir === 'left' ? 2 : 0),
          y: startY - (dir === 'down' ? -2 : dir === 'up' ? 2 : 0) }
      ],
      direction: dir,
      nextDirection: dir,
      dead: false,
      score: 0,
      waiting: false, // Start moving immediately
      moveStartTime: performance.now() // Learning period starts now
    };

    // Start game timer if this is the first player
    if (!this.gameStartTime) {
      this.gameStartTime = performance.now();
    }

  }

  onPlayerLeave(player) {
    delete this.snakes[player.id];
  }

  onPlayerInput(player, input) {
    const snake = this.snakes[player.id];
    if (!snake || snake.dead) return;

    // Use tilt to determine direction
    const gamma = input.x; // left/right tilt (-1 to 1)
    const beta = input.y;  // forward/back tilt (-1 to 1)

    const threshold = 0.15; // Lower threshold for more responsive controls

    let newDirection = null;

    // Get the opposite direction based on body position (not stored direction)
    // This prevents 180-degree turns even on first move
    const head = snake.body[0];
    const neck = snake.body[1];
    let oppositeDir = null;
    if (neck) {
      if (neck.x < head.x) oppositeDir = 'left';      // neck is left of head, can't go left
      else if (neck.x > head.x) oppositeDir = 'right'; // neck is right of head, can't go right
      else if (neck.y < head.y) oppositeDir = 'up';    // neck is above head, can't go up
      else if (neck.y > head.y) oppositeDir = 'down';  // neck is below head, can't go down
    }

    // Determine strongest direction from tilt
    if (Math.abs(gamma) > Math.abs(beta) && Math.abs(gamma) > threshold) {
      // Horizontal movement is stronger
      if (gamma < 0 && oppositeDir !== 'left') {
        newDirection = 'left';
      } else if (gamma > 0 && oppositeDir !== 'right') {
        newDirection = 'right';
      }
    } else if (Math.abs(beta) > threshold) {
      // Vertical movement is stronger
      if (beta < 0 && oppositeDir !== 'up') {
        newDirection = 'up';
      } else if (beta > 0 && oppositeDir !== 'down') {
        newDirection = 'down';
      }
    }

    if (newDirection) {
      snake.nextDirection = newDirection;
    }
  }

  // Check if a snake is still in learning period (invulnerable)
  isInLearningPeriod(snake) {
    if (snake.waiting) return true; // Still waiting to start
    if (!snake.moveStartTime) return false;
    return (performance.now() - snake.moveStartTime) < this.learningPeriod;
  }

  // Get remaining learning time in seconds
  getLearningTimeRemaining(snake) {
    if (snake.waiting) return Math.ceil(this.learningPeriod / 1000);
    if (!snake.moveStartTime) return 0;
    const remaining = this.learningPeriod - (performance.now() - snake.moveStartTime);
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  // Create explosion effect at snake's position
  createExplosion(snake) {
    const particles = [];
    const color = snake.player.color;

    // Create particles from each body segment
    snake.body.forEach((segment, i) => {
      const px = this.offsetX + segment.x * this.gridSize + this.gridSize / 2;
      const py = this.offsetY + segment.y * this.gridSize + this.gridSize / 2;

      // More particles for head
      const count = i === 0 ? 12 : 4;
      for (let j = 0; j < count; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 200;
        particles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 8,
          color: color
        });
      }
    });

    this.explosions.push({
      particles,
      startTime: performance.now()
    });
  }

  // Kill a snake and trigger explosion
  killSnake(snake) {
    if (snake.dead) return;
    snake.dead = true;
    this.createExplosion(snake);
  }

  update(deltaTime) {
    if (this.gameOver) return;

    // Don't run game logic until we have players
    if (Object.keys(this.snakes).length === 0) return;

    // Gradually speed up after learning period
    if (this.gameStartTime) {
      const elapsed = performance.now() - this.gameStartTime;
      if (elapsed < this.learningPeriod) {
        // Lerp from slow to fast over the learning period
        const t = elapsed / this.learningPeriod;
        this.gameSpeed = this.slowGameSpeed - (this.slowGameSpeed - this.baseGameSpeed) * t;
      } else {
        this.gameSpeed = this.baseGameSpeed;
      }
    }

    this.lastMoveTime += deltaTime * 1000;

    if (this.lastMoveTime >= this.gameSpeed) {
      this.lastMoveTime = 0;
      this.moveSnakes();
      this.checkCollisions();
      this.checkWinner();
    }
  }

  moveSnakes() {
    Object.values(this.snakes).forEach(snake => {
      if (snake.dead || snake.waiting) return; // Don't move if waiting for input

      // Apply next direction
      snake.direction = snake.nextDirection;

      // Get current head
      const head = snake.body[0];
      let newX = head.x;
      let newY = head.y;

      // Move in direction
      switch (snake.direction) {
        case 'up': newY--; break;
        case 'down': newY++; break;
        case 'left': newX--; break;
        case 'right': newX++; break;
      }

      // During warmup, auto-turn if about to hit wall
      if (this.isInLearningPeriod(snake)) {
        if (newX < 0 || newX >= this.gridWidth || newY < 0 || newY >= this.gridHeight) {
          // Pick a safe direction to turn
          const safeDirections = [];
          if (head.x > 0 && snake.direction !== 'right') safeDirections.push('left');
          if (head.x < this.gridWidth - 1 && snake.direction !== 'left') safeDirections.push('right');
          if (head.y > 0 && snake.direction !== 'down') safeDirections.push('up');
          if (head.y < this.gridHeight - 1 && snake.direction !== 'up') safeDirections.push('down');

          if (safeDirections.length > 0) {
            // Pick a random safe direction
            snake.direction = safeDirections[Math.floor(Math.random() * safeDirections.length)];
            snake.nextDirection = snake.direction;

            // Recalculate new position
            newX = head.x;
            newY = head.y;
            switch (snake.direction) {
              case 'up': newY--; break;
              case 'down': newY++; break;
              case 'left': newX--; break;
              case 'right': newX++; break;
            }
          }
        }
      }

      // Add new head
      snake.body.unshift({ x: newX, y: newY });

      // Check if eating food
      const foodIndex = this.food.findIndex(f => f.x === newX && f.y === newY);
      if (foodIndex >= 0) {
        // Eat food - don't remove tail
        this.food.splice(foodIndex, 1);
        snake.score++;
        this.spawnFood();
      } else {
        // Remove tail
        snake.body.pop();
      }
    });
  }

  checkCollisions() {
    // Don't check collisions if grid isn't set up yet
    if (this.gridWidth === 0 || this.gridHeight === 0) return;

    Object.values(this.snakes).forEach(snake => {
      // Skip dead snakes and snakes still waiting for first input
      if (snake.dead || snake.waiting) return;

      // Skip collision checks for snakes in learning period (invulnerable)
      if (this.isInLearningPeriod(snake)) return;

      const head = snake.body[0];

      // Wall collision
      if (head.x < 0 || head.x >= this.gridWidth ||
          head.y < 0 || head.y >= this.gridHeight) {
        this.killSnake(snake);
        return;
      }

      // Self collision (skip head)
      for (let i = 1; i < snake.body.length; i++) {
        if (snake.body[i].x === head.x && snake.body[i].y === head.y) {
          this.killSnake(snake);
          return;
        }
      }

      // Other snake collision (skip snakes in learning period - they're invulnerable)
      Object.values(this.snakes).forEach(other => {
        if (other === snake || other.dead || this.isInLearningPeriod(other)) return;

        for (const segment of other.body) {
          if (segment.x === head.x && segment.y === head.y) {
            this.killSnake(snake);
            return;
          }
        }
      });
    });
  }

  checkWinner() {
    const allSnakes = Object.values(this.snakes);
    const aliveSnakes = allSnakes.filter(s => !s.dead);
    const learningSnakes = allSnakes.filter(s => this.isInLearningPeriod(s));
    const totalSnakes = allSnakes.length;

    // Don't check for winner if no players yet
    if (totalSnakes === 0) return;

    // Don't end game while any snake is still in learning period
    if (learningSnakes.length > 0) return;

    if (totalSnakes > 1 && aliveSnakes.length <= 1) {
      this.gameOver = true;
      if (aliveSnakes.length === 1) {
        this.winner = aliveSnakes[0];
      }
    } else if (totalSnakes === 1 && aliveSnakes.length === 0) {
      this.gameOver = true;
    }
  }

  render() {
    const ctx = this.ctx;

    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw grid (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= this.gridWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX + x * this.gridSize, this.offsetY);
      ctx.lineTo(this.offsetX + x * this.gridSize, this.offsetY + this.gridHeight * this.gridSize);
      ctx.stroke();
    }

    for (let y = 0; y <= this.gridHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(this.offsetX, this.offsetY + y * this.gridSize);
      ctx.lineTo(this.offsetX + this.gridWidth * this.gridSize, this.offsetY + y * this.gridSize);
      ctx.stroke();
    }

    // Draw border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.strokeRect(
      this.offsetX,
      this.offsetY,
      this.gridWidth * this.gridSize,
      this.gridHeight * this.gridSize
    );

    // Draw food
    this.food.forEach(f => {
      const px = this.offsetX + f.x * this.gridSize + this.gridSize / 2;
      const py = this.offsetY + f.y * this.gridSize + this.gridSize / 2;

      ctx.fillStyle = '#ff6b6b';
      ctx.shadowColor = '#ff6b6b';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, this.gridSize / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw snakes
    const now = performance.now();
    Object.values(this.snakes).forEach(snake => {
      // Skip dead snakes - they exploded
      if (snake.dead) return;

      const inLearning = this.isInLearningPeriod(snake);

      if (inLearning) {
        // Blinking transparency during learning period
        const blinkSpeed = 200; // ms per blink cycle
        const blink = Math.sin(now / blinkSpeed * Math.PI);
        ctx.globalAlpha = 0.4 + blink * 0.3; // Oscillate between 0.1 and 0.7
      }

      // Draw body
      snake.body.forEach((segment, i) => {
        const px = this.offsetX + segment.x * this.gridSize;
        const py = this.offsetY + segment.y * this.gridSize;

        // Head is brighter
        if (i === 0) {
          ctx.fillStyle = snake.player.color;
          ctx.shadowColor = snake.player.color;
          ctx.shadowBlur = 8;
        } else {
          // Body fades slightly
          ctx.fillStyle = snake.player.color;
          ctx.shadowBlur = 0;
        }

        const padding = i === 0 ? 1 : 2;
        ctx.fillRect(
          px + padding,
          py + padding,
          this.gridSize - padding * 2,
          this.gridSize - padding * 2
        );

        // Eyes on head
        if (i === 0) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'white';
          const eyeSize = 4;
          const eyeOffset = 5;

          let ex1, ey1, ex2, ey2;
          switch (snake.direction) {
            case 'up':
              ex1 = px + this.gridSize / 2 - eyeOffset;
              ey1 = py + this.gridSize / 3;
              ex2 = px + this.gridSize / 2 + eyeOffset;
              ey2 = py + this.gridSize / 3;
              break;
            case 'down':
              ex1 = px + this.gridSize / 2 - eyeOffset;
              ey1 = py + this.gridSize * 2 / 3;
              ex2 = px + this.gridSize / 2 + eyeOffset;
              ey2 = py + this.gridSize * 2 / 3;
              break;
            case 'left':
              ex1 = px + this.gridSize / 3;
              ey1 = py + this.gridSize / 2 - eyeOffset;
              ex2 = px + this.gridSize / 3;
              ey2 = py + this.gridSize / 2 + eyeOffset;
              break;
            case 'right':
              ex1 = px + this.gridSize * 2 / 3;
              ey1 = py + this.gridSize / 2 - eyeOffset;
              ex2 = px + this.gridSize * 2 / 3;
              ey2 = py + this.gridSize / 2 + eyeOffset;
              break;
          }

          ctx.beginPath();
          ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
          ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Player name above head (and countdown during learning period)
        const head = snake.body[0];
        const px = this.offsetX + head.x * this.gridSize + this.gridSize / 2;
        const baseY = this.offsetY + head.y * this.gridSize - 10;

        ctx.globalAlpha = 1; // Reset alpha for text

        // Draw player name first
        const displayName = snake.player.name || `Player ${snake.player.number}`;
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Background pill for name
        const textWidth = ctx.measureText(displayName).width;
        const pillPadding = 6;
        const pillHeight = 18;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        const pillX = px - textWidth / 2 - pillPadding;
        const pillW = textWidth + pillPadding * 2;
        const pillR = pillHeight / 2;
        ctx.roundRect(pillX, baseY - pillHeight, pillW, pillHeight, pillR);
        ctx.fill();

        ctx.strokeStyle = snake.player.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.fillText(displayName, px, baseY - 3);

        // Show "Get Ready" countdown ABOVE the name during learning period
        if (inLearning) {
          const timeRemaining = this.getLearningTimeRemaining(snake);
          const countdownText = `Get Ready: ${timeRemaining}`;

          ctx.font = 'bold 16px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          // Countdown background pill - positioned above the name
          const countdownWidth = ctx.measureText(countdownText).width;
          const countdownPadding = 8;
          const countdownHeight = 22;
          const countdownY = baseY - pillHeight - 8; // Above the name pill

          ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
          ctx.beginPath();
          ctx.roundRect(
            px - countdownWidth / 2 - countdownPadding,
            countdownY - countdownHeight,
            countdownWidth + countdownPadding * 2,
            countdownHeight,
            countdownHeight / 2
          );
          ctx.fill();

          ctx.fillStyle = '#1a1a2e';
          ctx.fillText(countdownText, px, countdownY - 4);
        }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });

    // Draw explosions
    this.explosions = this.explosions.filter(explosion => {
      const elapsed = now - explosion.startTime;
      if (elapsed > this.explosionDuration) return false; // Remove finished explosions

      const progress = elapsed / this.explosionDuration;
      const alpha = 1 - progress; // Fade out

      explosion.particles.forEach(p => {
        // Update position
        p.x += p.vx * 0.016; // Approximate dt
        p.y += p.vy * 0.016;
        p.vy += 300 * 0.016; // Gravity

        // Draw particle
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      return true; // Keep this explosion
    });

    // Draw scoreboard (top-right)
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'right';
    let y = 30;

    const sortedSnakes = Object.values(this.snakes).sort((a, b) => b.score - a.score);
    sortedSnakes.forEach(snake => {
      const displayName = snake.player.name || `P${snake.player.number}`;
      const status = snake.dead ? ' 💀' : '';
      ctx.fillStyle = snake.dead ? '#666' : snake.player.color;
      ctx.fillText(`${displayName}: ${snake.score}${status}`, this.width - 20, y);
      y += 28;
    });

    // Instructions at bottom
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('Tilt to steer • Eat food to grow • Don\'t crash!', this.width / 2, this.height - 20);

    // Game over screen
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (this.winner) {
        const winnerName = this.winner.player.name || `Player ${this.winner.player.number}`;

        ctx.font = '60px system-ui';
        ctx.fillText('🐍', this.width / 2, this.height / 2 - 80);

        ctx.shadowColor = this.winner.player.color;
        ctx.shadowBlur = 30;
        ctx.fillStyle = this.winner.player.color;
        ctx.font = 'bold 64px system-ui';
        ctx.fillText(`${winnerName} WINS!`, this.width / 2, this.height / 2);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 32px system-ui';
        ctx.fillText(`Score: ${this.winner.score}`, this.width / 2, this.height / 2 + 50);
      } else {
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 64px system-ui';
        ctx.fillText('GAME OVER', this.width / 2, this.height / 2);
      }
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SnakeGame;
}
