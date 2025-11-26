// Beach Volleyball Game (Slime Volleyball style)
// Players move left/right and jump to hit the ball

class BeachVolleyballGame extends GameEngine {
  constructor(canvas, connectionManager) {
    super(canvas, connectionManager);

    // Court dimensions (set in resize)
    this.courtLeft = 0;
    this.courtRight = 0;
    this.groundY = 0;
    this.netX = 0;
    this.netHeight = 0;

    // Player settings (slime style - semicircles)
    this.playerRadius = 50;
    this.playerSpeed = 450;
    this.jumpForce = 650;
    this.playerGravity = 1200;
    this.players = {};

    // Ball settings
    this.ball = null;
    this.ballRadius = 32;
    this.ballGravity = 800;
    this.ballBounce = 0.7;
    this.ballMaxSpeed = 1000;

    // Game state
    this.scores = { left: 0, right: 0 };
    this.winScore = 5;
    this.servingTeam = 'left';
    this.waitingForServe = true;
    this.rallyOver = false;
    this.rallyEndTime = 0;
    this.rallyPauseMs = 1500;

    // Force initial resize to set dimensions
    this.resize();
    this.resetBall();
  }

  resize() {
    super.resize();

    // Court boundaries
    const padding = 50;
    this.courtLeft = padding;
    this.courtRight = this.width - padding;
    this.groundY = this.height - 100;
    this.netX = this.width / 2;
    this.netHeight = 120; // Short net that players can jump over
  }

  resetBall() {
    // Position ball above serving team's player
    const serveX = this.servingTeam === 'left'
      ? this.width * 0.25
      : this.width * 0.75;

    this.ball = {
      x: serveX,
      y: this.groundY - 200,
      vx: 0,
      vy: 0,
      lastHitBy: null
    };
    this.waitingForServe = true;
  }

  onPlayerJoin(player) {
    // Assign team based on player count
    const leftCount = Object.values(this.players).filter(p => p.team === 'left').length;
    const rightCount = Object.values(this.players).filter(p => p.team === 'right').length;
    const team = leftCount <= rightCount ? 'left' : 'right';

    // Position player on their side
    const baseX = team === 'left' ? this.width * 0.25 : this.width * 0.75;

    this.players[player.id] = {
      player,
      team,
      x: baseX,
      y: this.groundY,
      vx: 0,
      vy: 0,
      onGround: true,
      jumpRequested: false
    };

    console.log('Player', player.number, 'joined team', team);
  }

  onPlayerLeave(player) {
    delete this.players[player.id];
  }

  // Called when player taps jump button
  jump(playerId) {
    const p = this.players[playerId];
    if (!p) return;
    p.jumpRequested = true;
  }

  // Keep serve() for backwards compatibility - just triggers jump
  serve(playerId) {
    this.jump(playerId);
  }

  update(dt) {
    const now = performance.now();

    // Handle pause after point
    if (this.rallyOver) {
      if (now > this.rallyEndTime + this.rallyPauseMs) {
        this.rallyOver = false;
        this.resetBall();
      }
      return;
    }

    // Update player positions
    Object.values(this.players).forEach(p => {
      const input = p.player.input;

      // Horizontal movement from tilt (left/right only)
      p.vx = input.x * this.playerSpeed;

      // Handle jump
      if (p.jumpRequested && p.onGround) {
        p.vy = -this.jumpForce;
        p.onGround = false;
      }
      p.jumpRequested = false;

      // Apply gravity
      if (!p.onGround) {
        p.vy += this.playerGravity * dt;
      }

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Ground collision
      if (p.y >= this.groundY) {
        p.y = this.groundY;
        p.vy = 0;
        p.onGround = true;
      }

      // Constrain to team's half horizontally
      if (p.team === 'left') {
        p.x = Math.max(this.courtLeft + this.playerRadius, Math.min(this.netX - this.playerRadius - 5, p.x));
      } else {
        p.x = Math.max(this.netX + this.playerRadius + 5, Math.min(this.courtRight - this.playerRadius, p.x));
      }
    });

    // Check if only one player (practice mode)
    const playerCount = Object.keys(this.players).length;
    const isSinglePlayer = playerCount === 1;

    // Ball collision with players (slime style - semicircle collision)
    // This happens even when waiting for serve - hitting the ball starts the rally
    Object.values(this.players).forEach(p => {
      // Check collision with top half of player (semicircle)
      const dx = this.ball.x - p.x;
      const dy = this.ball.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = this.ballRadius + this.playerRadius;

      // Only collide if ball is above player's base and within radius
      if (dist < minDist && dist > 0 && this.ball.y < p.y + 10) {
        // If waiting for serve, only serving team (or single player) can hit
        if (this.waitingForServe) {
          if (!isSinglePlayer && p.team !== this.servingTeam) return;
          this.waitingForServe = false;
          console.log('Player', p.player.number, 'served by hitting the ball!');
        }

        // Normal vector from player center to ball
        const nx = dx / dist;
        const ny = dy / dist;

        // Push ball out
        this.ball.x = p.x + nx * minDist;
        this.ball.y = p.y + ny * minDist;

        // Reflect velocity off the slime surface
        const dot = this.ball.vx * nx + this.ball.vy * ny;

        // Add player's velocity influence
        const hitPower = 600;
        this.ball.vx = this.ball.vx - 2 * dot * nx + p.vx * 0.3;
        this.ball.vy = this.ball.vy - 2 * dot * ny + hitPower * ny;

        // Ensure ball goes upward if hit from above
        if (this.ball.vy > -100) {
          this.ball.vy = -300;
        }

        // Clamp speed
        const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
        if (speed > this.ballMaxSpeed) {
          this.ball.vx = (this.ball.vx / speed) * this.ballMaxSpeed;
          this.ball.vy = (this.ball.vy / speed) * this.ballMaxSpeed;
        }

        this.ball.lastHitBy = p.team;
      }
    });

    // Update ball physics
    if (!this.waitingForServe) {
      // Apply gravity
      this.ball.vy += this.ballGravity * dt;

      // Update position
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;

      // Ball collision with net
      const netTop = this.groundY - this.netHeight;
      if (Math.abs(this.ball.x - this.netX) < this.ballRadius + 8 &&
          this.ball.y + this.ballRadius > netTop) {
        // Bounce off net
        this.ball.vx *= -0.6;
        this.ball.x = this.ball.x < this.netX
          ? this.netX - this.ballRadius - 8
          : this.netX + this.ballRadius + 8;
      }

      // Ball collision with ceiling (top of screen)
      if (this.ball.y - this.ballRadius < 80) {
        this.ball.y = 80 + this.ballRadius;
        this.ball.vy *= -this.ballBounce;
      }

      // Ball out of bounds - sides
      if (this.ball.x - this.ballRadius < this.courtLeft) {
        this.ball.x = this.courtLeft + this.ballRadius;
        this.ball.vx *= -this.ballBounce;
      }
      if (this.ball.x + this.ballRadius > this.courtRight) {
        this.ball.x = this.courtRight - this.ballRadius;
        this.ball.vx *= -this.ballBounce;
      }

      // Ball hit ground - point scored (or reset in single player)
      if (this.ball.y + this.ballRadius > this.groundY) {
        if (isSinglePlayer) {
          // In practice mode, just reset the ball
          this.resetBall();
        } else {
          const ballSide = this.ball.x < this.netX ? 'left' : 'right';
          const scoringTeam = ballSide === 'left' ? 'right' : 'left';
          this.scorePoint(scoringTeam);
        }
      }
    } else {
      // Ball floats waiting for serve
      this.ball.y = this.groundY - 180 + Math.sin(now / 300) * 10;
    }
  }

  scorePoint(team) {
    if (this.rallyOver) return;

    this.scores[team]++;
    this.servingTeam = team;
    this.rallyOver = true;
    this.rallyEndTime = performance.now();

    // Reset player positions
    Object.values(this.players).forEach(p => {
      p.x = p.team === 'left' ? this.width * 0.25 : this.width * 0.75;
      p.y = this.groundY;
      p.vy = 0;
      p.onGround = true;
    });

    console.log('Point for', team, '! Score:', this.scores.left, '-', this.scores.right);
  }

  render() {
    const ctx = this.ctx;

    // Sky background
    const skyGradient = ctx.createLinearGradient(0, 0, 0, this.height);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(0.6, '#E0F6FF');
    skyGradient.addColorStop(1, '#f4d03f');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Sun
    ctx.fillStyle = '#FFE066';
    ctx.beginPath();
    ctx.arc(this.width - 120, 100, 50, 0, Math.PI * 2);
    ctx.fill();

    // Ground/Sand
    ctx.fillStyle = '#f4d03f';
    ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

    // Ground line
    ctx.strokeStyle = '#d4b02f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.courtLeft, this.groundY);
    ctx.lineTo(this.courtRight, this.groundY);
    ctx.stroke();

    // Net post
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(this.netX - 6, this.groundY - this.netHeight - 20, 12, this.netHeight + 20);

    // Net
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    const netTop = this.groundY - this.netHeight;
    ctx.beginPath();
    ctx.moveTo(this.netX, netTop);
    ctx.lineTo(this.netX, this.groundY);
    ctx.stroke();

    // Net mesh pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    for (let y = netTop; y < this.groundY; y += 15) {
      ctx.beginPath();
      ctx.moveTo(this.netX - 8, y);
      ctx.lineTo(this.netX + 8, y);
      ctx.stroke();
    }

    // Draw players (slime style - semicircles)
    Object.values(this.players).forEach(p => {
      // Shadow on ground
      const shadowY = this.groundY;
      const shadowScale = 1 - (this.groundY - p.y) / 400;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(p.x, shadowY + 5, this.playerRadius * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Slime body (semicircle)
      ctx.fillStyle = p.player.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.playerRadius, Math.PI, 0, false);
      ctx.lineTo(p.x + this.playerRadius, p.y);
      ctx.lineTo(p.x - this.playerRadius, p.y);
      ctx.closePath();
      ctx.fill();

      // Slime outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.playerRadius, Math.PI, 0, false);
      ctx.stroke();

      // Eye
      const eyeX = p.x + (p.team === 'left' ? 15 : -15);
      const eyeY = p.y - 20;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(eyeX + (p.team === 'left' ? 3 : -3), eyeY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Player name above - with background pill for visibility
      const displayName = p.player.name || `Player ${p.player.number}`;
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const nameY = p.y - this.playerRadius - 20;
      const textWidth = ctx.measureText(displayName).width;
      const pillPadding = 10;
      const pillHeight = 24;

      // Background pill
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      const pillX = p.x - textWidth / 2 - pillPadding;
      const pillW = textWidth + pillPadding * 2;
      const pillR = pillHeight / 2;
      ctx.moveTo(pillX + pillR, nameY - pillHeight / 2);
      ctx.lineTo(pillX + pillW - pillR, nameY - pillHeight / 2);
      ctx.arc(pillX + pillW - pillR, nameY, pillR, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(pillX + pillR, nameY + pillHeight / 2);
      ctx.arc(pillX + pillR, nameY, pillR, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      // Team color border
      ctx.strokeStyle = p.player.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Name text with slight glow
      ctx.shadowColor = p.player.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'white';
      ctx.fillText(displayName, p.x, nameY);
      ctx.shadowBlur = 0;
    });

    // Draw ball
    if (this.ball) {
      // Ball shadow on ground
      const shadowY = this.groundY;
      const shadowScale = Math.max(0.3, 1 - (this.groundY - this.ball.y) / 400);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(this.ball.x, shadowY + 5, this.ballRadius * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ballRadius, 0, Math.PI * 2);
      ctx.fill();

      // Volleyball pattern
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ballRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Cross lines on ball
      ctx.beginPath();
      ctx.moveTo(this.ball.x - this.ballRadius, this.ball.y);
      ctx.lineTo(this.ball.x + this.ballRadius, this.ball.y);
      ctx.moveTo(this.ball.x, this.ball.y - this.ballRadius);
      ctx.lineTo(this.ball.x, this.ball.y + this.ballRadius);
      ctx.stroke();
    }

    // Score display - party style!
    const scoreBoxW = 220;
    const scoreBoxH = 70;
    const scoreBoxX = this.width / 2 - scoreBoxW / 2;
    const scoreBoxY = 15;

    // Rounded rectangle background with gradient
    ctx.save();
    ctx.beginPath();
    const radius = 20;
    ctx.moveTo(scoreBoxX + radius, scoreBoxY);
    ctx.lineTo(scoreBoxX + scoreBoxW - radius, scoreBoxY);
    ctx.quadraticCurveTo(scoreBoxX + scoreBoxW, scoreBoxY, scoreBoxX + scoreBoxW, scoreBoxY + radius);
    ctx.lineTo(scoreBoxX + scoreBoxW, scoreBoxY + scoreBoxH - radius);
    ctx.quadraticCurveTo(scoreBoxX + scoreBoxW, scoreBoxY + scoreBoxH, scoreBoxX + scoreBoxW - radius, scoreBoxY + scoreBoxH);
    ctx.lineTo(scoreBoxX + radius, scoreBoxY + scoreBoxH);
    ctx.quadraticCurveTo(scoreBoxX, scoreBoxY + scoreBoxH, scoreBoxX, scoreBoxY + scoreBoxH - radius);
    ctx.lineTo(scoreBoxX, scoreBoxY + radius);
    ctx.quadraticCurveTo(scoreBoxX, scoreBoxY, scoreBoxX + radius, scoreBoxY);
    ctx.closePath();

    // Gradient fill
    const grad = ctx.createLinearGradient(scoreBoxX, scoreBoxY, scoreBoxX, scoreBoxY + scoreBoxH);
    grad.addColorStop(0, 'rgba(30, 30, 50, 0.9)');
    grad.addColorStop(1, 'rgba(20, 20, 40, 0.95)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Colorful border
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Blue team score (left)
    ctx.font = 'bold 42px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#3498db';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#5dade2';
    ctx.fillText(this.scores.left, this.width / 2 - 55, scoreBoxY + scoreBoxH / 2);

    // Dash separator
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 32px system-ui';
    ctx.fillText('—', this.width / 2, scoreBoxY + scoreBoxH / 2);

    // Red team score (right)
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ec7063';
    ctx.font = 'bold 42px system-ui';
    ctx.fillText(this.scores.right, this.width / 2 + 55, scoreBoxY + scoreBoxH / 2);
    ctx.shadowBlur = 0;

    // Serve indicator - styled box
    const playerCount = Object.keys(this.players).length;
    if (this.waitingForServe && !this.rallyOver) {
      const boxW = 300;
      const boxH = 60;
      const boxX = this.width / 2 - boxW / 2;
      const boxY = this.height / 2 - boxH / 2;

      // Draw rounded rectangle
      ctx.beginPath();
      const r = 15;
      ctx.moveTo(boxX + r, boxY);
      ctx.lineTo(boxX + boxW - r, boxY);
      ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
      ctx.lineTo(boxX + boxW, boxY + boxH - r);
      ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
      ctx.lineTo(boxX + r, boxY + boxH);
      ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
      ctx.lineTo(boxX, boxY + r);
      ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
      ctx.closePath();

      ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (playerCount === 1) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffd700';
        ctx.fillText('Jump to serve!', this.width / 2, this.height / 2);
      } else {
        const isLeft = this.servingTeam === 'left';
        ctx.shadowColor = isLeft ? '#3498db' : '#e74c3c';
        ctx.shadowBlur = 10;
        ctx.fillStyle = isLeft ? '#5dade2' : '#ec7063';
        const teamName = isLeft ? 'BLUE' : 'RED';
        ctx.fillText(`${teamName} — Jump to serve!`, this.width / 2, this.height / 2);
      }
      ctx.shadowBlur = 0;
    }

    // Win message - party celebration!
    if (this.scores.left >= this.winScore || this.scores.right >= this.winScore) {
      ctx.fillStyle = 'rgba(10, 10, 30, 0.92)';
      ctx.fillRect(0, 0, this.width, this.height);

      const winner = this.scores.left >= this.winScore ? 'left' : 'right';
      const isLeft = winner === 'left';
      const winnerName = isLeft ? 'BLUE' : 'RED';

      // Glowing winner text
      ctx.shadowColor = isLeft ? '#3498db' : '#e74c3c';
      ctx.shadowBlur = 30;
      ctx.fillStyle = isLeft ? '#5dade2' : '#ec7063';
      ctx.font = 'bold 80px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${winnerName} WINS!`, this.width / 2, this.height / 2 - 20);

      // Trophy emoji
      ctx.shadowBlur = 0;
      ctx.font = '60px system-ui';
      ctx.fillText('🏆', this.width / 2, this.height / 2 - 100);

      // Final score
      ctx.font = 'bold 36px system-ui';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.fillText(`${this.scores.left} — ${this.scores.right}`, this.width / 2, this.height / 2 + 60);
      ctx.shadowBlur = 0;
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BeachVolleyballGame;
}
