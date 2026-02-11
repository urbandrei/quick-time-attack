/**
 * Hand-designed level layouts.
 *
 * Each layout defines rooms (position, size, spawn points) and hallways
 * (connections between rooms specified by side + offset).
 *
 * Hallway geometry is derived automatically by the Level class.
 *   - from/to: room indices
 *   - fromSide/toSide: 'top' | 'bottom' | 'left' | 'right'
 *   - offset: 0–1, position along the wall (0.5 = centered)
 */

export const LEVEL_LAYOUTS = [
  // Layout 0 — L-shape: center room with east and south branches
  {
    rooms: [
      // Room 0 — starting room (center)
      {
        x: 160, y: 60,
        width: 480, height: 480,
        spawnPoints: [
          { rx: 0.25, ry: 0.25, type: 'bat' },
          { rx: 0.75, ry: 0.75, type: 'bat' },
        ],
      },
      // Room 1 — east room
      {
        x: 760, y: 60,
        width: 480, height: 480,
        spawnPoints: [
          { rx: 0.5, ry: 0.3, type: 'gopher' },
          { rx: 0.5, ry: 0.7, type: 'bat' },
        ],
      },
      // Room 2 — south room
      {
        x: 160, y: 660,
        width: 480, height: 480,
        spawnPoints: [
          { rx: 0.3, ry: 0.5, type: 'bat' },
          { rx: 0.7, ry: 0.5, type: 'gopher' },
        ],
      },
    ],
    hallways: [
      { from: 0, fromSide: 'right', to: 1, toSide: 'left', offset: 0.5 },
      { from: 0, fromSide: 'bottom', to: 2, toSide: 'top', offset: 0.5 },
    ],
    playerStart: { room: 0, rx: 0.5, ry: 0.5 },
  },
];
