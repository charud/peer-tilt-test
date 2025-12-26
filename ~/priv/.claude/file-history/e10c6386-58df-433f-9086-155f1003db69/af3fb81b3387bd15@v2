// Music Quiz Game - Guess the song from Spotify!

class MusicQuizGame extends GameEngine {
  constructor(canvas, connectionManager, spotify) {
    super(canvas, connectionManager);
    this.spotify = spotify;

    // Game phases: 'genre-select', 'loading', 'playing', 'answering', 'results', 'game-over'
    this.phase = 'genre-select';

    // Genre selection
    this.genres = [];
    this.selectedGenre = null;
    this.genreVotes = {}; // playerId -> genre

    // Quiz state
    this.tracks = []; // All fetched tracks for this genre
    this.currentTrack = null;
    this.options = []; // 5 options: { displayName, isCorrect }
    this.playerAnswers = {}; // playerId -> { answerIndex, time }
    this.scores = {}; // playerId -> total score
    this.roundNumber = 0;
    this.totalRounds = 10;
    this.roundStartTime = 0;
    this.roundTimeout = 15000; // 15 seconds to answer
    this.resultsTimeout = 4000; // 4 seconds to show results

    // Audio
    this.audio = new Audio();
    this.audio.volume = 0.8;

    // UI state
    this.statusMessage = 'Loading...';
    this.showingResults = false;
    this.resultTimer = null;

    // Initialize
    this.loadGenres();
  }

  async loadGenres() {
    // Hardcoded genres (Spotify deprecated the genre seeds endpoint)
    this.genres = [
      'pop', 'rock', 'hip-hop', 'electronic', 'r-n-b', 'indie',
      'jazz', 'classical', 'country', 'metal', 'disco', 'latin'
    ];
    this.broadcastGenreSelect();
  }

  broadcastGenreSelect() {
    this.connection.broadcast({
      type: 'quiz-genre-select',
      genres: this.genres
    });
  }

  onPlayerJoin(player) {
    // Initialize score
    this.scores[player.id] = 0;

    // Send current state to new player
    if (this.phase === 'genre-select') {
      this.connection.sendToPlayer(player.id, {
        type: 'quiz-genre-select',
        genres: this.genres
      });
    } else if (this.phase === 'answering') {
      this.connection.sendToPlayer(player.id, {
        type: 'quiz-question',
        options: this.options.map(o => o.displayName),
        roundNumber: this.roundNumber,
        totalRounds: this.totalRounds
      });
    }
  }

  onPlayerLeave(player) {
    delete this.scores[player.id];
    delete this.playerAnswers[player.id];
    delete this.genreVotes[player.id];
  }

  onPlayerInput(player, data) {
    if (data.type === 'select-genre' && this.phase === 'genre-select') {
      this.genreVotes[player.id] = data.genre;
      // First vote wins (or could do majority)
      this.selectedGenre = data.genre;
      this.startGame();
    }
    else if (data.type === 'quiz-answer' && this.phase === 'answering') {
      // Only accept first answer from each player
      if (!this.playerAnswers[player.id]) {
        this.playerAnswers[player.id] = {
          answerIndex: data.answerIndex,
          time: Date.now() - this.roundStartTime
        };

        // Notify player their answer was received
        this.connection.sendToPlayer(player.id, {
          type: 'quiz-answer-received',
          answerIndex: data.answerIndex
        });

        // Check if all players have answered
        if (this.allPlayersAnswered()) {
          this.endRound();
        }
      }
    }
  }

  allPlayersAnswered() {
    const playerIds = this.connection.playerList.map(p => p.id);
    return playerIds.every(id => this.playerAnswers[id]);
  }

  async startGame() {
    this.phase = 'loading';
    this.statusMessage = `Loading ${this.selectedGenre} tracks...`;

    try {
      // Fetch tracks for selected genre
      this.tracks = await this.spotify.getTracksByGenre(this.selectedGenre, 50);

      if (this.tracks.length < 5) {
        // Try recommendations as fallback
        const moreTracks = await this.spotify.getRecommendations(this.selectedGenre, 30);
        this.tracks = [...this.tracks, ...moreTracks];
      }

      if (this.tracks.length < 5) {
        this.statusMessage = 'Not enough tracks found';
        return;
      }

      // Shuffle tracks
      this.shuffleArray(this.tracks);

      // Start first round
      this.roundNumber = 0;
      this.startRound();
    } catch (e) {
      console.error('Failed to load tracks:', e);
      this.statusMessage = 'Failed to load tracks';
    }
  }

  startRound() {
    this.roundNumber++;
    this.playerAnswers = {};
    this.phase = 'playing';

    // Pick a track
    const trackIndex = (this.roundNumber - 1) % this.tracks.length;
    this.currentTrack = this.tracks[trackIndex];

    // Generate options (1 correct + 4 wrong)
    this.options = this.generateOptions(this.currentTrack);

    // Start playing audio
    this.audio.src = this.currentTrack.previewUrl;
    this.audio.currentTime = 0;
    this.audio.play().catch(e => console.error('Audio play error:', e));

    // Short delay before accepting answers (let music start)
    setTimeout(() => {
      this.phase = 'answering';
      this.roundStartTime = Date.now();

      // Notify players
      this.connection.broadcast({
        type: 'quiz-question',
        options: this.options.map(o => o.displayName),
        roundNumber: this.roundNumber,
        totalRounds: this.totalRounds
      });

      // Set timeout for round
      this.resultTimer = setTimeout(() => {
        if (this.phase === 'answering') {
          this.endRound();
        }
      }, this.roundTimeout);
    }, 500);
  }

  generateOptions(correctTrack) {
    const options = [{ displayName: correctTrack.displayName, isCorrect: true }];

    // Get 4 wrong options from other tracks
    const otherTracks = this.tracks.filter(t => t.id !== correctTrack.id);
    this.shuffleArray(otherTracks);

    for (let i = 0; i < 4 && i < otherTracks.length; i++) {
      options.push({ displayName: otherTracks[i].displayName, isCorrect: false });
    }

    // Shuffle options
    this.shuffleArray(options);
    return options;
  }

  endRound() {
    if (this.resultTimer) {
      clearTimeout(this.resultTimer);
      this.resultTimer = null;
    }

    this.phase = 'results';

    // Stop audio
    this.audio.pause();

    // Calculate scores for this round
    const correctIndex = this.options.findIndex(o => o.isCorrect);
    const roundScores = {};

    for (const [playerId, answer] of Object.entries(this.playerAnswers)) {
      if (answer.answerIndex === correctIndex) {
        // Correct answer
        const basePoints = 1000;
        // Speed bonus: up to 500 points, decreasing over time
        const speedBonus = Math.max(0, 500 - Math.floor(answer.time / 30));
        const points = basePoints + speedBonus;
        this.scores[playerId] = (this.scores[playerId] || 0) + points;
        roundScores[playerId] = points;
      } else {
        roundScores[playerId] = 0;
      }
    }

    // Players who didn't answer
    for (const player of this.connection.playerList) {
      if (!this.playerAnswers[player.id]) {
        roundScores[player.id] = 0;
      }
    }

    // Broadcast results
    this.connection.broadcast({
      type: 'quiz-result',
      correctIndex,
      correctAnswer: this.currentTrack.displayName,
      albumArt: this.currentTrack.albumArt,
      roundScores,
      totalScores: this.scores,
      roundNumber: this.roundNumber,
      totalRounds: this.totalRounds
    });

    // Send individual results
    for (const player of this.connection.playerList) {
      const answer = this.playerAnswers[player.id];
      this.connection.sendToPlayer(player.id, {
        type: 'quiz-your-result',
        correct: answer && answer.answerIndex === correctIndex,
        points: roundScores[player.id] || 0,
        totalScore: this.scores[player.id] || 0
      });
    }

    // Check if game over or next round
    setTimeout(() => {
      if (this.roundNumber >= this.totalRounds) {
        this.endGame();
      } else {
        this.startRound();
      }
    }, this.resultsTimeout);
  }

  endGame() {
    this.phase = 'game-over';
    this.audio.pause();

    // Find winner
    let winner = null;
    let highScore = 0;
    for (const [playerId, score] of Object.entries(this.scores)) {
      if (score > highScore) {
        highScore = score;
        winner = this.connection.playerList.find(p => p.id === playerId);
      }
    }

    // Broadcast game over
    this.connection.broadcast({
      type: 'quiz-gameover',
      scores: this.scores,
      winner: winner ? { id: winner.id, name: winner.name, score: highScore } : null
    });
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  stop() {
    super.stop();
    this.audio.pause();
    if (this.resultTimer) {
      clearTimeout(this.resultTimer);
    }
  }

  update(dt) {
    // Check round timeout handled by setTimeout
  }

  render() {
    const ctx = this.ctx;

    // Dark gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.phase === 'genre-select') {
      this.renderGenreSelect(ctx);
    } else if (this.phase === 'loading') {
      this.renderLoading(ctx);
    } else if (this.phase === 'playing' || this.phase === 'answering') {
      this.renderQuestion(ctx);
    } else if (this.phase === 'results') {
      this.renderResults(ctx);
    } else if (this.phase === 'game-over') {
      this.renderGameOver(ctx);
    }
  }

  renderGenreSelect(ctx) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 64px system-ui';
    ctx.fillText('Music Quiz', this.width / 2, 100);

    ctx.fillStyle = 'white';
    ctx.font = '32px system-ui';
    ctx.fillText('Pick a Genre!', this.width / 2, 180);

    ctx.font = '24px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('Vote on your phone', this.width / 2, 230);

    // Show genres in a grid
    const cols = 4;
    const rows = Math.ceil(this.genres.length / cols);
    const boxWidth = 200;
    const boxHeight = 60;
    const gap = 20;
    const startX = this.width / 2 - (cols * (boxWidth + gap) - gap) / 2;
    const startY = 300;

    ctx.font = 'bold 20px system-ui';
    this.genres.forEach((genre, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (boxWidth + gap);
      const y = startY + row * (boxHeight + gap);

      // Box background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(x, y, boxWidth, boxHeight, 12);
      ctx.fill();

      // Genre name
      ctx.fillStyle = 'white';
      ctx.fillText(genre.charAt(0).toUpperCase() + genre.slice(1), x + boxWidth / 2, y + boxHeight / 2);
    });
  }

  renderLoading(ctx) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 48px system-ui';
    ctx.fillText(this.statusMessage, this.width / 2, this.height / 2);
  }

  renderQuestion(ctx) {
    // Round indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '24px system-ui';
    ctx.fillText(`Round ${this.roundNumber} of ${this.totalRounds}`, this.width / 2, 50);

    // Genre
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 32px system-ui';
    ctx.fillText(this.selectedGenre.toUpperCase(), this.width / 2, 100);

    // Album art
    if (this.currentTrack?.albumArt && this.albumArtImage) {
      const artSize = 250;
      ctx.drawImage(
        this.albumArtImage,
        this.width / 2 - artSize / 2,
        150,
        artSize,
        artSize
      );
    } else if (this.currentTrack?.albumArt) {
      // Load album art
      this.albumArtImage = new Image();
      this.albumArtImage.src = this.currentTrack.albumArt;
    }

    // Music note animation
    const time = Date.now() / 1000;
    ctx.font = '80px system-ui';
    ctx.fillStyle = '#ffd700';
    const bounce = Math.sin(time * 4) * 10;
    ctx.fillText('🎵', this.width / 2, 280 + bounce);

    // Question prompt
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px system-ui';
    ctx.fillText('What song is this?', this.width / 2, 450);

    // Options
    const optionWidth = 500;
    const optionHeight = 50;
    const optionGap = 15;
    const startY = 520;

    ctx.font = '24px system-ui';
    this.options.forEach((option, i) => {
      const y = startY + i * (optionHeight + optionGap);

      // Option background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - optionWidth / 2, y, optionWidth, optionHeight, 10);
      ctx.fill();

      // Option number
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, this.width / 2 - optionWidth / 2 + 15, y + optionHeight / 2);

      // Option text
      ctx.fillStyle = 'white';
      ctx.fillText(option.displayName, this.width / 2 - optionWidth / 2 + 50, y + optionHeight / 2);
      ctx.textAlign = 'center';
    });

    // Timer bar
    if (this.phase === 'answering') {
      const elapsed = Date.now() - this.roundStartTime;
      const remaining = Math.max(0, 1 - elapsed / this.roundTimeout);
      const barWidth = 400;
      const barHeight = 8;
      const barY = this.height - 60;

      // Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - barWidth / 2, barY, barWidth, barHeight, 4);
      ctx.fill();

      // Progress
      ctx.fillStyle = remaining > 0.3 ? '#4ade80' : '#f87171';
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - barWidth / 2, barY, barWidth * remaining, barHeight, 4);
      ctx.fill();
    }

    // Answer count
    const answered = Object.keys(this.playerAnswers).length;
    const total = this.connection.playerCount;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '20px system-ui';
    ctx.fillText(`${answered}/${total} answered`, this.width / 2, this.height - 30);
  }

  renderResults(ctx) {
    // Correct answer reveal
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 36px system-ui';
    ctx.fillText('Correct Answer:', this.width / 2, 100);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 42px system-ui';
    ctx.fillText(this.currentTrack.displayName, this.width / 2, 160);

    // Album art
    if (this.albumArtImage) {
      const artSize = 200;
      ctx.drawImage(
        this.albumArtImage,
        this.width / 2 - artSize / 2,
        200,
        artSize,
        artSize
      );
    }

    // Scoreboard
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 32px system-ui';
    ctx.fillText('Scores', this.width / 2, 450);

    const sortedPlayers = this.connection.playerList
      .map(p => ({ ...p, score: this.scores[p.id] || 0 }))
      .sort((a, b) => b.score - a.score);

    ctx.font = '24px system-ui';
    sortedPlayers.forEach((player, i) => {
      const y = 500 + i * 40;
      const answer = this.playerAnswers[player.id];
      const correctIndex = this.options.findIndex(o => o.isCorrect);
      const isCorrect = answer && answer.answerIndex === correctIndex;

      ctx.fillStyle = player.color;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${player.name}`, this.width / 2 - 150, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = isCorrect ? '#4ade80' : '#f87171';
      ctx.fillText(isCorrect ? '+' + (this.scores[player.id] - (player.prevScore || 0)) : '0', this.width / 2 + 50, y);

      ctx.fillStyle = 'white';
      ctx.fillText(player.score.toString(), this.width / 2 + 150, y);
      ctx.textAlign = 'center';
    });
  }

  renderGameOver(ctx) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 72px system-ui';
    ctx.fillText('Game Over!', this.width / 2, 150);

    // Find winner
    const sortedPlayers = this.connection.playerList
      .map(p => ({ ...p, score: this.scores[p.id] || 0 }))
      .sort((a, b) => b.score - a.score);

    if (sortedPlayers.length > 0) {
      const winner = sortedPlayers[0];

      ctx.font = '48px system-ui';
      ctx.fillText('🏆', this.width / 2, 250);

      ctx.fillStyle = winner.color;
      ctx.font = 'bold 48px system-ui';
      ctx.fillText(`${winner.name} WINS!`, this.width / 2, 320);

      ctx.fillStyle = 'white';
      ctx.font = '32px system-ui';
      ctx.fillText(`${winner.score} points`, this.width / 2, 380);
    }

    // Full scoreboard
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '28px system-ui';
    ctx.fillText('Final Standings', this.width / 2, 460);

    ctx.font = '24px system-ui';
    sortedPlayers.forEach((player, i) => {
      const y = 510 + i * 40;
      ctx.fillStyle = player.color;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${player.name}`, this.width / 2 - 100, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'white';
      ctx.fillText(player.score.toString(), this.width / 2 + 100, y);
      ctx.textAlign = 'center';
    });
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MusicQuizGame;
}
