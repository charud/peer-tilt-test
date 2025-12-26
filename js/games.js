// Game Registry - Available games

const GAMES = {
  'bumper-cars': {
    id: 'bumper-cars',
    name: 'Bumper Cars',
    subtitle: 'Sumo Arena',
    description: 'Push others off the platform!',
    icon: '🚗',
    minPlayers: 1,
    maxPlayers: 8,
    controllerType: 'tilt'
  },
  'beach-volleyball': {
    id: 'beach-volleyball',
    name: 'Beach Volleyball',
    subtitle: 'Sunny Smash',
    description: '2v2 volleyball on the beach!',
    icon: '🏐',
    minPlayers: 2,
    maxPlayers: 8,
    controllerType: 'tilt-serve'
  },
  'snake': {
    id: 'snake',
    name: 'Snake',
    subtitle: 'Multiplayer',
    description: 'Eat food, grow long, survive!',
    icon: '🐍',
    minPlayers: 1,
    maxPlayers: 8,
    controllerType: 'tilt'
  },
  'music-quiz': {
    id: 'music-quiz',
    name: 'Music Quiz',
    subtitle: 'Name That Tune',
    description: 'Guess the song from Spotify!',
    icon: '🎵',
    minPlayers: 1,
    maxPlayers: 8,
    controllerType: 'quiz',
    requiresSpotify: true
  }
};

const GAME_LIST = Object.values(GAMES);
