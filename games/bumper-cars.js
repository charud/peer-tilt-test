// Bumper Cars Game

class BumperCarsGame extends GameEngine {
  constructor(canvas, connectionManager) {
    super(canvas, connectionManager);
    this.cars = {}; // player id -> car object
    this.arenaRadius = 0;
    this.carRadius = 40;
    this.maxSpeed = 400;
    this.acceleration = 600;
    this.friction = 0.98;
    this.bounceForce = 500;
  }

  resize() {
    super.resize();
    this.arenaRadius = Math.min(this.width, this.height) * 0.45;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
  }

  onPlayerJoin(player) {
    // Spawn car at random position in arena
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.arenaRadius * 0.5;

    this.cars[player.id] = {
      player,
      x: this.centerX + Math.cos(angle) * dist,
      y: this.centerY + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      angle: angle,
      hits: 0,
      eliminated: false
    };
  }

  onPlayerLeave(player) {
    delete this.cars[player.id];
  }

  update(dt) {
    const carList = Object.values(this.cars);

    // Update each car
    carList.forEach(car => {
      if (car.eliminated) return;

      const input = car.player.input;

      // Apply acceleration based on tilt
      car.vx += input.x * this.acceleration * dt;
      car.vy += input.y * this.acceleration * dt;

      // Apply friction
      car.vx *= this.friction;
      car.vy *= this.friction;

      // Clamp speed
      const speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
      if (speed > this.maxSpeed) {
        car.vx = (car.vx / speed) * this.maxSpeed;
        car.vy = (car.vy / speed) * this.maxSpeed;
      }

      // Update position
      car.x += car.vx * dt;
      car.y += car.vy * dt;

      // Update angle based on velocity
      if (speed > 10) {
        car.angle = Math.atan2(car.vy, car.vx);
      }

      // Check arena boundary
      const distFromCenter = Math.sqrt(
        Math.pow(car.x - this.centerX, 2) +
        Math.pow(car.y - this.centerY, 2)
      );

      if (distFromCenter > this.arenaRadius - this.carRadius) {
        // Push back into arena
        const angle = Math.atan2(car.y - this.centerY, car.x - this.centerX);
        car.x = this.centerX + Math.cos(angle) * (this.arenaRadius - this.carRadius);
        car.y = this.centerY + Math.sin(angle) * (this.arenaRadius - this.carRadius);

        // Bounce off wall
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        const dot = car.vx * nx + car.vy * ny;
        car.vx -= 2 * dot * nx * 0.7;
        car.vy -= 2 * dot * ny * 0.7;
      }
    });

    // Check car-to-car collisions
    for (let i = 0; i < carList.length; i++) {
      for (let j = i + 1; j < carList.length; j++) {
        const a = carList[i];
        const b = carList[j];
        if (a.eliminated || b.eliminated) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = this.carRadius * 2;

        if (dist < minDist && dist > 0) {
          // Collision!
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate cars
          const overlap = minDist - dist;
          a.x -= nx * overlap / 2;
          a.y -= ny * overlap / 2;
          b.x += nx * overlap / 2;
          b.y += ny * overlap / 2;

          // Exchange momentum (elastic collision)
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dot = dvx * nx + dvy * ny;

          a.vx -= dot * nx;
          a.vy -= dot * ny;
          b.vx += dot * nx;
          b.vy += dot * ny;

          // Add extra bounce
          a.vx -= nx * this.bounceForce * dt;
          a.vy -= ny * this.bounceForce * dt;
          b.vx += nx * this.bounceForce * dt;
          b.vy += ny * this.bounceForce * dt;

          // Track hits
          a.hits++;
          b.hits++;
        }
      }
    }
  }

  render() {
    const ctx = this.ctx;

    // Clear with dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw arena
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.arenaRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw arena floor
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.arenaRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.fill();

    // Draw cars
    Object.values(this.cars).forEach(car => {
      if (car.eliminated) return;

      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      // Car body
      ctx.fillStyle = car.player.color;
      ctx.beginPath();
      ctx.roundRect(-this.carRadius, -this.carRadius * 0.6, this.carRadius * 2, this.carRadius * 1.2, 8);
      ctx.fill();

      // Car front indicator
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.roundRect(this.carRadius * 0.5, -this.carRadius * 0.3, this.carRadius * 0.4, this.carRadius * 0.6, 4);
      ctx.fill();

      ctx.restore();

      // Player number above car
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(car.player.number, car.x, car.y - this.carRadius - 10);
    });

    // Draw player count
    ctx.fillStyle = 'white';
    ctx.font = '20px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`Players: ${Object.keys(this.cars).length}`, 20, 30);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BumperCarsGame;
}
