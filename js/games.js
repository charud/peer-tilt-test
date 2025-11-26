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
  }
};

const GAME_LIST = Object.values(GAMES);
