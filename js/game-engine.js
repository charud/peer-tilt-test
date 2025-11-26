// Game Engine - Base class for all games

class GameEngine {
  constructor(canvas, connectionManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.connection = connectionManager;
    this.gameObjects = [];
    this.running = false;
    this.lastTime = 0;

    // Resize canvas to fill screen
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  stop() {
    this.running = false;
  }

  gameLoop() {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // Delta time in seconds, capped
    this.lastTime = now;

    this.update(dt);
    this.render();

    requestAnimationFrame(() => this.gameLoop());
  }

  // Override in subclass
  update(dt) {}

  // Override in subclass
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  // Override in subclass
  onPlayerJoin(player) {}

  // Override in subclass
  onPlayerLeave(player) {}
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameEngine;
}
