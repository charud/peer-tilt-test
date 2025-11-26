// Beach Volleyball Game
// 2v2 (or more) volleyball with tilt controls

class BeachVolleyballGame extends GameEngine {
  constructor(canvas, connectionManager) {
    super(canvas, connectionManager);

    // Court dimensions (set in resize)
    this.courtLeft = 0;
    this.courtRight = 0;
    this.courtTop = 0;
    this.courtBottom = 0;
    this.netX = 0;

    // Player settings
    this.playerRadius = 35;
    this.playerSpeed = 400;
    this.players = {}; // player id -> player object

    // Ball settings
    this.ball = null;
    this.ballRadius = 20;
    this.ballGravity = 600;
    this.ballBounce = 0.75;
    this.ballMaxSpeed = 800;
    this.ballHitForce = 500;

    // Game state
    this.scores = { left: 0, right: 0 };
    this.winScore = 5;
    this.servingTeam = 'left';
    this.waitingForServe = true;
    this.rallyOver = false;
    this.rallyEndTime = 0;
    this.rallyPauseMs = 1500;

    // Initialize
    this.resetBall();
  }

  resize() {
    super.resize();

    // Court boundaries with padding
    const padding = 50;
    this.courtLeft = padding;
    this.courtRight = this.width - padding;
    this.courtTop = padding + 60; // Room for score
    this.courtBottom = this.height - padding;
    this.netX = this.width / 2;
  }

  resetBall() {
    // Position ball on serving team's side
    const serveX = this.servingTeam === 'left'
      ? this.width * 0.25
      : this.width * 0.75;

    this.ball = {
      x: serveX,
      y: this.height * 0.4,
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
    const teamPlayers = Object.values(this.players).filter(p => p.team === team);
    const yOffset = (teamPlayers.length + 1) * 80;

    this.players[player.id] = {
      player,
      team,
      x: team === 'left' ? this.width * 0.25 : this.width * 0.75,
      y: this.height / 2 + yOffset - 120,
      vx: 0,
      vy: 0
    };

    console.log('Player', player.number, 'joined team', team);
  }

  onPlayerLeave(player) {
    delete this.players[player.id];
  }

  serve(playerId) {
    if (!this.waitingForServe) return;

    const p = this.players[playerId];
    if (!p) return;

    // Only serving team can serve
    if (p.team !== this.servingTeam) return;

    console.log('Player', p.player.number, 'served!');

    // Launch ball towards opponent
    const direction = this.servingTeam === 'left' ? 1 : -1;
    this.ball.vx = direction * 300;
    this.ball.vy = -250;
    this.waitingForServe = false;
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

      // Move based on tilt
      p.vx = input.x * this.playerSpeed;
      p.vy = input.y * this.playerSpeed;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Constrain to team's half
      const halfWidth = (this.courtRight - this.courtLeft) / 2 - this.playerRadius;
      if (p.team === 'left') {
        p.x = Math.max(this.courtLeft + this.playerRadius, Math.min(this.netX - this.playerRadius - 10, p.x));
      } else {
        p.x = Math.max(this.netX + this.playerRadius + 10, Math.min(this.courtRight - this.playerRadius, p.x));
      }

      // Constrain vertically
      p.y = Math.max(this.courtTop + this.playerRadius, Math.min(this.courtBottom - this.playerRadius, p.y));
    });

    // Update ball if not waiting for serve
    if (!this.waitingForServe) {
      // Apply gravity
      this.ball.vy += this.ballGravity * dt;

      // Update position
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;

      // Ball collision with players
      Object.values(this.players).forEach(p => {
        const dx = this.ball.x - p.x;
        const dy = this.ball.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = this.ballRadius + this.playerRadius;

        if (dist < minDist && dist > 0) {
          // Bounce ball off player
          const nx = dx / dist;
          const ny = dy / dist;

          // Push ball out
          this.ball.x = p.x + nx * minDist;
          this.ball.y = p.y + ny * minDist;

          // Reflect velocity and add force
          const dot = this.ball.vx * nx + this.ball.vy * ny;
          this.ball.vx = this.ball.vx - 2 * dot * nx + nx * this.ballHitForce + p.vx * 0.5;
          this.ball.vy = this.ball.vy - 2 * dot * ny + ny * this.ballHitForce * 0.5 - 200; // Pop up

          // Clamp speed
          const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
          if (speed > this.ballMaxSpeed) {
            this.ball.vx = (this.ball.vx / speed) * this.ballMaxSpeed;
            this.ball.vy = (this.ball.vy / speed) * this.ballMaxSpeed;
          }

          this.ball.lastHitBy = p.team;
        }
      });

      // Ball collision with net (simple barrier)
      if (Math.abs(this.ball.x - this.netX) < this.ballRadius + 5 &&
          this.ball.y > this.height * 0.4) {
        // Bounce off net
        this.ball.vx *= -0.5;
        this.ball.x = this.ball.x < this.netX
          ? this.netX - this.ballRadius - 5
          : this.netX + this.ballRadius + 5;
      }

      // Ball out of bounds - top
      if (this.ball.y < this.courtTop) {
        this.ball.y = this.courtTop;
        this.ball.vy *= -this.ballBounce;
      }

      // Ball out of bounds - sides
      if (this.ball.x < this.courtLeft || this.ball.x > this.courtRight) {
        // Point for other team
        const scoringTeam = this.ball.x < this.courtLeft ? 'right' : 'left';
        this.scorePoint(scoringTeam);
      }

      // Ball hit floor
      if (this.ball.y > this.courtBottom - this.ballRadius) {
        // Point for team on other side
        const ballSide = this.ball.x < this.netX ? 'left' : 'right';
        const scoringTeam = ballSide === 'left' ? 'right' : 'left';
        this.scorePoint(scoringTeam);
      }
    }
  }

  scorePoint(team) {
    if (this.rallyOver) return;

    this.scores[team]++;
    this.servingTeam = team;
    this.rallyOver = true;
    this.rallyEndTime = performance.now();

    console.log('Point for', team, '! Score:', this.scores.left, '-', this.scores.right);

    // Check for win
    if (this.scores[team] >= this.winScore) {
      console.log(team, 'WINS!');
      // Could add win screen here
    }
  }

  render() {
    const ctx = this.ctx;

    // Beach background
    ctx.fillStyle = '#f4d03f'; // Sand
    ctx.fillRect(0, 0, this.width, this.height);

    // Sky gradient at top
    const skyGradient = ctx.createLinearGradient(0, 0, 0, this.height * 0.3);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#f4d03f');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, this.width, this.height * 0.3);

    // Court area
    ctx.fillStyle = '#e6c229';
    ctx.fillRect(this.courtLeft, this.courtTop, this.courtRight - this.courtLeft, this.courtBottom - this.courtTop);

    // Court lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.courtLeft, this.courtTop, this.courtRight - this.courtLeft, this.courtBottom - this.courtTop);

    // Net
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.netX, this.height * 0.35);
    ctx.lineTo(this.netX, this.courtBottom);
    ctx.stroke();

    // Net pattern
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let y = this.height * 0.35; y < this.courtBottom; y += 20) {
      ctx.beginPath();
      ctx.moveTo(this.netX - 3, y);
      ctx.lineTo(this.netX + 3, y);
      ctx.stroke();
    }

    // Draw players
    Object.values(this.players).forEach(p => {
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(p.x, this.courtBottom - 5, this.playerRadius * 0.8, this.playerRadius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Player body
      ctx.fillStyle = p.player.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.playerRadius, 0, Math.PI * 2);
      ctx.fill();

      // Team indicator
      ctx.fillStyle = p.team === 'left' ? '#3498db' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(p.x, p.y - this.playerRadius - 10, 8, 0, Math.PI * 2);
      ctx.fill();

      // Player number
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.player.number, p.x, p.y);
    });

    // Draw ball
    if (this.ball) {
      // Ball shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(this.ball.x, this.courtBottom - 5, this.ballRadius * 0.8, this.ballRadius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ballRadius, 0, Math.PI * 2);
      ctx.fill();

      // Ball stripes (volleyball look)
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ballRadius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Score display
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.scores.left}`, this.width * 0.25, 50);
    ctx.fillText(`${this.scores.right}`, this.width * 0.75, 50);
    ctx.font = '24px system-ui';
    ctx.fillText('-', this.width * 0.5, 45);

    // Team labels
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#3498db';
    ctx.fillText('BLUE', this.width * 0.25, 75);
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('RED', this.width * 0.75, 75);

    // Serve indicator
    if (this.waitingForServe) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(this.width / 2 - 150, this.height / 2 - 30, 300, 60);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px system-ui';
      ctx.textAlign = 'center';
      const teamName = this.servingTeam === 'left' ? 'BLUE' : 'RED';
      ctx.fillText(`${teamName} team: Tap SERVE!`, this.width / 2, this.height / 2 + 5);
    }

    // Win message
    if (this.scores.left >= this.winScore || this.scores.right >= this.winScore) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 64px system-ui';
      ctx.textAlign = 'center';
      const winner = this.scores.left >= this.winScore ? 'BLUE' : 'RED';
      ctx.fillText(`${winner} WINS!`, this.width / 2, this.height / 2);
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BeachVolleyballGame;
}
