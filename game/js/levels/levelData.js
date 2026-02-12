/**
 * Hand-designed level layouts.
 *
 * Each layout defines rooms (position, size) and hallways
 * (connections between rooms specified by side + offset).
 * Enemy spawning is handled dynamically by enemySpawner.js.
 *
 * Hallway geometry is derived automatically by the Level class.
 *   - from/to: room indices
 *   - fromSide/toSide: 'top' | 'bottom' | 'left' | 'right'
 *   - offset: 0–1, position along the wall (0.5 = centered)
 */

export const CHALLENGE_LAYOUT = {
  rooms: [
    {
      x: 160, y: 60,
      width: 480, height: 480,
    },
  ],
  hallways: [],
  playerStart: { room: 0, rx: 0.5, ry: 0.25 },
};

export const COFFEE_BREAK_LAYOUT = {
  rooms: [
    {
      x: 160, y: 60,
      width: 480, height: 480,
    },
  ],
  hallways: [],
  playerStart: { room: 0, rx: 0.5, ry: 0.25 },
};

export const LEVEL_LAYOUTS = [
  // Layout 0 — L-shape: center room with east and south branches
  {
    rooms: [
      // Room 0 — starting room (center)
      {
        x: 160, y: 60,
        width: 480, height: 480,
      },
      // Room 1 — east room
      {
        x: 760, y: 60,
        width: 480, height: 480,
      },
      // Room 2 — south room
      {
        x: 160, y: 660,
        width: 480, height: 480,
      },
    ],
    hallways: [
      { from: 0, fromSide: 'right', to: 1, toSide: 'left', offset: 0.5 },
      { from: 0, fromSide: 'bottom', to: 2, toSide: 'top', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 1 — T-shape: center room with north, east, west branches (4 rooms)
  {
    rooms: [
      // Room 0 — center (starting room)
      {
        x: 160, y: 300,
        width: 480, height: 480,
      },
      // Room 1 — north
      {
        x: 160, y: -300,
        width: 480, height: 480,
      },
      // Room 2 — east
      {
        x: 760, y: 300,
        width: 480, height: 480,
      },
      // Room 3 — west
      {
        x: -440, y: 300,
        width: 480, height: 480,
      },
    ],
    hallways: [
      { from: 0, fromSide: 'top', to: 1, toSide: 'bottom', offset: 0.5 },
      { from: 0, fromSide: 'right', to: 2, toSide: 'left', offset: 0.5 },
      { from: 0, fromSide: 'left', to: 3, toSide: 'right', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 2 — Corridor: three rooms in a vertical line (3 rooms)
  {
    rooms: [
      // Room 0 — center (starting room)
      {
        x: 160, y: 60,
        width: 480, height: 480,
      },
      // Room 1 — north
      {
        x: 160, y: -540,
        width: 480, height: 480,
      },
      // Room 2 — south
      {
        x: 160, y: 660,
        width: 480, height: 480,
      },
    ],
    hallways: [
      { from: 0, fromSide: 'top', to: 1, toSide: 'bottom', offset: 0.5 },
      { from: 0, fromSide: 'bottom', to: 2, toSide: 'top', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 3 — L-shape: center + south + west
  {
    rooms: [
      { x: 160, y: 60, width: 480, height: 480 },
      { x: 160, y: 660, width: 480, height: 480 },
      { x: -440, y: 60, width: 480, height: 480 },
    ],
    hallways: [
      { from: 0, fromSide: 'bottom', to: 1, toSide: 'top', offset: 0.5 },
      { from: 0, fromSide: 'left', to: 2, toSide: 'right', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 4 — L-shape: center + west + north
  {
    rooms: [
      { x: 160, y: 60, width: 480, height: 480 },
      { x: -440, y: 60, width: 480, height: 480 },
      { x: 160, y: -540, width: 480, height: 480 },
    ],
    hallways: [
      { from: 0, fromSide: 'left', to: 1, toSide: 'right', offset: 0.5 },
      { from: 0, fromSide: 'top', to: 2, toSide: 'bottom', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 5 — L-shape: center + north + east
  {
    rooms: [
      { x: 160, y: 60, width: 480, height: 480 },
      { x: 160, y: -540, width: 480, height: 480 },
      { x: 760, y: 60, width: 480, height: 480 },
    ],
    hallways: [
      { from: 0, fromSide: 'top', to: 1, toSide: 'bottom', offset: 0.5 },
      { from: 0, fromSide: 'right', to: 2, toSide: 'left', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 6 — T-shape: center + north + east + south (missing west)
  {
    rooms: [
      { x: 160, y: 300, width: 480, height: 480 },
      { x: 160, y: -300, width: 480, height: 480 },
      { x: 760, y: 300, width: 480, height: 480 },
      { x: 160, y: 900, width: 480, height: 480 },
    ],
    hallways: [
      { from: 0, fromSide: 'top', to: 1, toSide: 'bottom', offset: 0.5 },
      { from: 0, fromSide: 'right', to: 2, toSide: 'left', offset: 0.5 },
      { from: 0, fromSide: 'bottom', to: 3, toSide: 'top', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 7 — T-shape: center + east + south + west (missing north)
  {
    rooms: [
      { x: 160, y: 300, width: 480, height: 480 },
      { x: 760, y: 300, width: 480, height: 480 },
      { x: 160, y: 900, width: 480, height: 480 },
      { x: -440, y: 300, width: 480, height: 480 },
    ],
    hallways: [
      { from: 0, fromSide: 'right', to: 1, toSide: 'left', offset: 0.5 },
      { from: 0, fromSide: 'bottom', to: 2, toSide: 'top', offset: 0.5 },
      { from: 0, fromSide: 'left', to: 3, toSide: 'right', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 8 — T-shape: center + north + south + west (missing east)
  {
    rooms: [
      { x: 160, y: 300, width: 480, height: 480 },
      { x: 160, y: -300, width: 480, height: 480 },
      { x: 160, y: 900, width: 480, height: 480 },
      { x: -440, y: 300, width: 480, height: 480 },
    ],
    hallways: [
      { from: 0, fromSide: 'top', to: 1, toSide: 'bottom', offset: 0.5 },
      { from: 0, fromSide: 'bottom', to: 2, toSide: 'top', offset: 0.5 },
      { from: 0, fromSide: 'left', to: 3, toSide: 'right', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },

  // Layout 9 — Corridor: three rooms in a horizontal line
  {
    rooms: [
      { x: 160, y: 60, width: 480, height: 480 },
      { x: 760, y: 60, width: 480, height: 480 },
      { x: -440, y: 60, width: 480, height: 480 },
    ],
    hallways: [
      { from: 0, fromSide: 'right', to: 1, toSide: 'left', offset: 0.5 },
      { from: 0, fromSide: 'left', to: 2, toSide: 'right', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },
];

export const POWER_UP_LAYOUT = {
  rooms: [
    // Room 0 — center (starting room)
    {
      x: 160, y: 60,
      width: 480, height: 480,
    },
    // Room 1 — north
    {
      x: 160, y: -540,
      width: 480, height: 480,
    },
    // Room 2 — east
    {
      x: 760, y: 60,
      width: 480, height: 480,
    },
    // Room 3 — south
    {
      x: 160, y: 660,
      width: 480, height: 480,
    },
    // Room 4 — west
    {
      x: -440, y: 60,
      width: 480, height: 480,
    },
  ],
  hallways: [
    { from: 0, fromSide: 'top', to: 1, toSide: 'bottom', offset: 0.5 },
    { from: 0, fromSide: 'right', to: 2, toSide: 'left', offset: 0.5 },
    { from: 0, fromSide: 'bottom', to: 3, toSide: 'top', offset: 0.5 },
    { from: 0, fromSide: 'left', to: 4, toSide: 'right', offset: 0.5 },
  ],
  playerStart: { room: 0, rx: 0.5, ry: 0.25 },
};
