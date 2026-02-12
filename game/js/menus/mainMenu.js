// Main menu area layout constants

export const MENU_ROOM = {
  x: -25,
  y: -25,
  width: 850,
  height: 650,
};

// Central hole — walk in to start the game
export const MENU_HOLE = {
  x: 400,
  y: 300,
  radius: 28,
};

// Player start position — above the hole
export const MENU_PLAYER_START = {
  x: 400,
  y: 150,
};

// Interactable objects around the hole
export const MENU_OBJECTS = [
  { id: 'settings',     x: 620, y: 150, size: 40, color: '#6688cc', label: 'SETTINGS' },
  { id: 'achievements', x: 180, y: 150, size: 40, color: '#ccaa44', label: 'TROPHIES' },
  { id: 'leaderboard',  x: 400, y: 490, size: 40, color: '#aa44cc', label: 'SCORES' },
];

export const INTERACTION_RADIUS = 40;
