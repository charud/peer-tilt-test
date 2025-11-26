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
    scriptSrc: 'games/bumper-cars.js',
    gameClass: 'BumperCarsGame'
  }
  // Add more games here later:
  // 'paint-splat': { ... },
  // 'marble-race': { ... },
};

const GAME_LIST = Object.values(GAMES);
