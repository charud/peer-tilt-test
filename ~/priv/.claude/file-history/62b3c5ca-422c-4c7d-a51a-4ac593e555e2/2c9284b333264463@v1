// Connection Manager - Handles PeerJS connections and QR code display

class ConnectionManager {
  constructor(options = {}) {
    this.players = {};
    this.peer = null;
    // Use fixed room code if provided, otherwise generate random
    this.roomCode = options.roomCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    this.controllerBaseUrl = options.controllerUrl || 'https://charud.github.io/peer-tilt-test/controller.html';
    this.onPlayerJoin = options.onPlayerJoin || (() => {});
    this.onPlayerLeave = options.onPlayerLeave || (() => {});
    this.onPlayerInput = options.onPlayerInput || (() => {});
    this.onReady = options.onReady || (() => {});
    this.onError = options.onError || (() => {});

    // Heartbeat settings
    this.heartbeatInterval = 3000; // Send ping every 3 seconds
    this.heartbeatTimeout = 10000; // Consider disconnected after 10 seconds
    this.heartbeatTimer = null;
  }

  get controllerUrl() {
    return `${this.controllerBaseUrl}?room=${this.roomCode}`;
  }

  get playerCount() {
    return Object.keys(this.players).length;
  }

  get playerList() {
    return Object.values(this.players);
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.peer = new Peer('tilt-' + this.roomCode);

      this.peer.on('open', (id) => {
        console.log('Connection ready, room:', this.roomCode);
        this.onReady(this.roomCode, this.controllerUrl);
        this.startHeartbeat();
        resolve();
      });

      this.peer.on('connection', (conn) => this.handleConnection(conn));

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        this.onError(err);
        reject(err);
      });
    });
  }

  handleConnection(conn) {
    const peerId = conn.peer;
    console.log('Player connecting:', peerId);

    conn.on('open', () => {
      const playerNumber = this.playerCount + 1;
      const hue = (playerNumber * 137) % 360; // Golden angle for nice color distribution

      const player = {
        id: peerId,
        peerId,
        conn,
        number: playerNumber,
        name: null, // Set when player sends set-name
        color: `hsl(${hue}, 70%, 50%)`,
        input: { x: 0, y: 0 }, // Normalized tilt input
        connected: true,
        lastHeartbeat: Date.now() // Track last response time
      };

      this.players[peerId] = player;
      console.log('Player connected:', playerNumber);
      // Don't call onPlayerJoin yet - wait for set-name
    });

    conn.on('data', (data) => {
      const player = this.players[peerId];
      if (!player) return;

      // Update heartbeat on any message from player
      player.lastHeartbeat = Date.now();

      // Handle heartbeat pong
      if (data.type === 'pong') {
        return; // Just update timestamp, already done above
      }

      // Handle set-name message - this officially "joins" the player
      if (data.type === 'set-name') {
        const wasJoined = player.name !== null;
        player.name = data.name || `Player ${player.number}`;
        console.log('Player', player.number, 'set name:', player.name);

        // If this is the first time setting name, trigger join
        if (!wasJoined) {
          this.onPlayerJoin(player);
        }
        return;
      }

      // Update input state for tilt messages
      if (data.type === 'tilt') {
        player.input.x = data.gamma; // -1 to 1, left/right
        player.input.y = data.beta;  // -1 to 1, forward/back
      }

      // Always call onPlayerInput for all message types
      this.onPlayerInput(player, data);
    });

    conn.on('close', () => {
      const player = this.players[peerId];
      if (player) {
        console.log('Player left:', player.number);
        player.connected = false;
        this.onPlayerLeave(player);
        delete this.players[peerId];
      }
    });
  }

  // Send message to specific player
  sendToPlayer(playerId, message) {
    const player = this.players[playerId];
    if (player && player.conn.open) {
      player.conn.send(message);
    }
  }

  // Send message to all players
  broadcast(message) {
    Object.values(this.players).forEach(player => {
      if (player.conn.open) {
        player.conn.send(message);
      }
    });
  }

  // Start heartbeat checking
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
      this.broadcast({ type: 'ping' });
    }, this.heartbeatInterval);
  }

  // Check for timed out players
  checkHeartbeats() {
    const now = Date.now();
    const timedOut = [];

    Object.values(this.players).forEach(player => {
      if (now - player.lastHeartbeat > this.heartbeatTimeout) {
        console.log('Player', player.number, 'timed out (no heartbeat)');
        timedOut.push(player);
      }
    });

    // Remove timed out players
    timedOut.forEach(player => {
      player.connected = false;
      this.onPlayerLeave(player);
      delete this.players[player.id];
      if (player.conn && player.conn.open) {
        player.conn.close();
      }
    });
  }

  destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConnectionManager;
}
