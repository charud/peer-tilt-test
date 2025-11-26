// Bumper Cars Game - Sumo Style!
// Push other players off the platform. Last one standing wins!

class BumperCarsGame extends GameEngine {
  constructor(canvas, connectionManager) {
    super(canvas, connectionManager);
    this.cars = {}; // player id -> car object
    this.arenaRadius = 0;
    this.carRadius = 40;
    this.maxSpeed = 500;
    this.acceleration = 1000;
    this.friction = 0.97;
    this.collisionForce = 1500; // Force applied on collision based on speed

    // Lives system
    this.maxLives = 3;
    this.respawnDelay = 1500; // ms before respawn

    // Animation durations
    this.fallDuration = 800; // ms for fall animation
    this.dropDuration = 400; // ms for drop-in animation

    // Initialize center immediately
    this.centerX = window.innerWidth / 2;
    this.centerY = window.innerHeight / 2;
    this.arenaRadius = Math.min(window.innerWidth, window.innerHeight) * 0.4;
  }

  resize() {
    super.resize();
    this.arenaRadius = Math.min(this.width, this.height) * 0.4;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
  }

  onPlayerJoin(player) {
    // Spawn car at random position in arena
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.arenaRadius * 0.3;

    this.cars[player.id] = {
      player,
      x: this.centerX + Math.cos(angle) * dist,
      y: this.centerY + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      angle: 0,
      lives: this.maxLives,
      respawning: false,
      respawnTime: 0,
      eliminated: false,
      knockouts: 0, // Track how many times this player knocked others off
      // Animation state
      falling: false,
      fallStart: 0,
      fallX: 0,
      fallY: 0,
      dropping: true, // Start with drop animation
      dropStart: performance.now()
    };

    console.log('Car created for player', player.number, 'with', this.maxLives, 'lives');
  }

  respawnCar(car) {
    // Respawn in center area
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.arenaRadius * 0.2;

    car.x = this.centerX + Math.cos(angle) * dist;
    car.y = this.centerY + Math.sin(angle) * dist;
    car.vx = 0;
    car.vy = 0;
    car.respawning = false;
    car.falling = false;

    // Start drop animation
    car.dropping = true;
    car.dropStart = performance.now();
  }

  onPlayerLeave(player) {
    delete this.cars[player.id];
  }

  update(dt) {
    const carList = Object.values(this.cars);
    const now = performance.now();

    // Update each car
    carList.forEach(car => {
      if (car.eliminated) return;

      // Handle falling animation
      if (car.falling) {
        const fallProgress = (now - car.fallStart) / this.fallDuration;
        if (fallProgress >= 1) {
          // Fall complete, start respawn timer
          car.falling = false;
          car.respawning = true;
          car.respawnTime = now + this.respawnDelay;
        }
        return; // Don't update while falling
      }

      // Handle respawning
      if (car.respawning) {
        if (now > car.respawnTime) {
          this.respawnCar(car);
        }
        return; // Don't update while respawning
      }

      // Handle drop animation (can still play while controllable)
      if (car.dropping) {
        const dropProgress = (now - car.dropStart) / this.dropDuration;
        if (dropProgress >= 1) {
          car.dropping = false;
        }
      }

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

      // Check if fallen off arena
      const distFromCenter = Math.sqrt(
        Math.pow(car.x - this.centerX, 2) +
        Math.pow(car.y - this.centerY, 2)
      );

      if (distFromCenter > this.arenaRadius + this.carRadius) {
        // Fell off! Start fall animation
        car.lives--;
        console.log('Player', car.player.number, 'fell off! Lives:', car.lives);

        if (car.lives <= 0) {
          car.eliminated = true;
          car.falling = true;
          car.fallStart = now;
          car.fallX = car.x;
          car.fallY = car.y;
          console.log('Player', car.player.number, 'ELIMINATED!');
        } else {
          // Start fall animation, then respawn
          car.falling = true;
          car.fallStart = now;
          car.fallX = car.x;
          car.fallY = car.y;
        }
      }
    });

    // Check car-to-car collisions
    for (let i = 0; i < carList.length; i++) {
      for (let j = i + 1; j < carList.length; j++) {
        const a = carList[i];
        const b = carList[j];
        if (a.eliminated || b.eliminated || a.respawning || b.respawning) continue;

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

          // Calculate relative velocity
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const relativeSpeed = Math.sqrt(dvx * dvx + dvy * dvy);

          // Exchange momentum (elastic collision)
          const dot = dvx * nx + dvy * ny;

          a.vx -= dot * nx;
          a.vy -= dot * ny;
          b.vx += dot * nx;
          b.vy += dot * ny;

          // Add extra force based on collision speed - this is the "push"!
          const pushForce = this.collisionForce * (1 + relativeSpeed / 100);
          a.vx -= nx * pushForce * dt;
          a.vy -= ny * pushForce * dt;
          b.vx += nx * pushForce * dt;
          b.vy += ny * pushForce * dt;

          // Bonus: instant velocity boost for extra bounce feel
          const bounceBoost = 150;
          a.vx -= nx * bounceBoost;
          a.vy -= ny * bounceBoost;
          b.vx += nx * bounceBoost;
          b.vy += ny * bounceBoost;

          // Track who hit whom (for potential knockout credit)
          a.lastHitBy = b.player.id;
          b.lastHitBy = a.player.id;
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
    const now = performance.now();

    Object.values(this.cars).forEach(car => {
      // Handle falling animation (shrink and fade)
      if (car.falling) {
        const progress = Math.min(1, (now - car.fallStart) / this.fallDuration);
        const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out

        const scale = 1 - easeOut * 0.8; // Shrink to 20%
        const opacity = 1 - easeOut; // Fade to 0
        const rotation = car.angle + easeOut * Math.PI * 2; // Spin while falling

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(car.fallX, car.fallY);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);

        // Car body
        ctx.fillStyle = car.player.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.carRadius, 0, Math.PI * 2);
        ctx.fill();

        // Front indicator
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(this.carRadius * 0.5, 0, this.carRadius * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        return;
      }

      if (car.eliminated) return;

      // Skip rendering if respawning (show pulsing ghost)
      if (car.respawning) {
        const pulse = 0.3 + Math.sin(now / 150) * 0.1;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = car.player.color;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.carRadius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }

      // Handle drop animation (scale in from above)
      let dropScale = 1;
      let dropOffset = 0;
      let dropOpacity = 1;

      if (car.dropping) {
        const progress = Math.min(1, (now - car.dropStart) / this.dropDuration);
        const easeOut = 1 - Math.pow(1 - progress, 2); // Quadratic ease out

        dropScale = 0.3 + easeOut * 0.7; // Scale from 30% to 100%
        dropOffset = (1 - easeOut) * -50; // Drop from above
        dropOpacity = 0.3 + easeOut * 0.7; // Fade in
      }

      ctx.save();
      ctx.globalAlpha = dropOpacity;
      ctx.translate(car.x, car.y + dropOffset);
      ctx.rotate(car.angle);
      ctx.scale(dropScale, dropScale);

      // Car body (simple circle for now)
      ctx.fillStyle = car.player.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.carRadius, 0, Math.PI * 2);
      ctx.fill();

      // Car front indicator (shows direction)
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(this.carRadius * 0.5, 0, this.carRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Player name above car (only when not dropping)
      if (!car.dropping) {
        const displayName = car.player.name || `Player ${car.player.number}`;
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const nameY = car.y - this.carRadius - 20;
        const textWidth = ctx.measureText(displayName).width;
        const pillPadding = 10;
        const pillHeight = 24;

        // Background pill
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        const pillX = car.x - textWidth / 2 - pillPadding;
        const pillW = textWidth + pillPadding * 2;
        const pillR = pillHeight / 2;
        ctx.moveTo(pillX + pillR, nameY - pillHeight / 2);
        ctx.lineTo(pillX + pillW - pillR, nameY - pillHeight / 2);
        ctx.arc(pillX + pillW - pillR, nameY, pillR, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(pillX + pillR, nameY + pillHeight / 2);
        ctx.arc(pillX + pillR, nameY, pillR, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        // Player color border
        ctx.strokeStyle = car.player.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Name text with glow
        ctx.shadowColor = car.player.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'white';
        ctx.fillText(displayName, car.x, nameY);
        ctx.shadowBlur = 0;
      }
    });

    // Draw scoreboard / lives
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'left';
    let y = 30;

    const sortedCars = Object.values(this.cars).sort((a, b) => b.lives - a.lives);
    sortedCars.forEach(car => {
      const displayName = car.player.name || `P${car.player.number}`;
      const hearts = '❤️'.repeat(Math.max(0, car.lives)) + '🖤'.repeat(Math.max(0, this.maxLives - car.lives));
      const status = car.eliminated ? ' (OUT)' : car.respawning ? ' (...)' : '';
      ctx.fillStyle = car.eliminated ? '#666' : car.player.color;
      ctx.fillText(`${displayName}: ${hearts}${status}`, 20, y);
      y += 28;
    });
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BumperCarsGame;
}
