// Snake Game - Multiplayer!
// Each player controls their own snake. Eat food to grow, don't hit walls or other snakes!

class SnakeGame extends GameEngine {
  constructor(canvas, connectionManager) {
    super(canvas, connectionManager);

    this.snakes = {}; // player id -> snake object
    this.food = [];
    this.gridSize = 20;
    this.gameSpeed = 100; // ms between moves
    this.lastMoveTime = 0;

    // Game area (set in resize)
    this.gridWidth = 0;
    this.gridHeight = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.gameOver = false;
    this.winner = null;

    this.resize();
    this.spawnFood();
    this.spawnFood();
    this.spawnFood();
  }

  resize() {
    super.resize();

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

  onPlayerJoin(player) {
    // Spawn snake at random position
    const startX = Math.floor(Math.random() * (this.gridWidth - 10)) + 5;
    const startY = Math.floor(Math.random() * (this.gridHeight - 10)) + 5;

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
      score: 0
    };

    console.log('Snake joined:', player.name || player.number);
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

    const threshold = 0.3;

    // Determine strongest direction from tilt
    if (Math.abs(gamma) > Math.abs(beta)) {
      // Horizontal movement
      if (gamma < -threshold && snake.direction !== 'right') {
        snake.nextDirection = 'left';
      } else if (gamma > threshold && snake.direction !== 'left') {
        snake.nextDirection = 'right';
      }
    } else {
      // Vertical movement
      if (beta < -threshold && snake.direction !== 'down') {
        snake.nextDirection = 'up';
      } else if (beta > threshold && snake.direction !== 'up') {
        snake.nextDirection = 'down';
      }
    }
  }

  update(deltaTime) {
    if (this.gameOver) return;

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
      if (snake.dead) return;

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
    Object.values(this.snakes).forEach(snake => {
      if (snake.dead) return;

      const head = snake.body[0];

      // Wall collision
      if (head.x < 0 || head.x >= this.gridWidth ||
          head.y < 0 || head.y >= this.gridHeight) {
        snake.dead = true;
        return;
      }

      // Self collision (skip head)
      for (let i = 1; i < snake.body.length; i++) {
        if (snake.body[i].x === head.x && snake.body[i].y === head.y) {
          snake.dead = true;
          return;
        }
      }

      // Other snake collision
      Object.values(this.snakes).forEach(other => {
        if (other === snake || other.dead) return;

        for (const segment of other.body) {
          if (segment.x === head.x && segment.y === head.y) {
            snake.dead = true;
            return;
          }
        }
      });
    });
  }

  checkWinner() {
    const aliveSnakes = Object.values(this.snakes).filter(s => !s.dead);
    const totalSnakes = Object.keys(this.snakes).length;

    // Don't check for winner if no players yet
    if (totalSnakes === 0) return;

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
    Object.values(this.snakes).forEach(snake => {
      if (snake.dead) {
        ctx.globalAlpha = 0.3;
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
        if (i === 0 && !snake.dead) {
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

      // Player name above head
      if (!snake.dead) {
        const head = snake.body[0];
        const px = this.offsetX + head.x * this.gridSize + this.gridSize / 2;
        const py = this.offsetY + head.y * this.gridSize - 10;

        const displayName = snake.player.name || `Player ${snake.player.number}`;
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // Background pill
        const textWidth = ctx.measureText(displayName).width;
        const pillPadding = 6;
        const pillHeight = 18;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        const pillX = px - textWidth / 2 - pillPadding;
        const pillW = textWidth + pillPadding * 2;
        const pillR = pillHeight / 2;
        ctx.roundRect(pillX, py - pillHeight, pillW, pillHeight, pillR);
        ctx.fill();

        ctx.strokeStyle = snake.player.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.fillText(displayName, px, py - 3);
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
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
