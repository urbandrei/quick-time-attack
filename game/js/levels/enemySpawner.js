import { Bat } from '../enemies/bat.js';
import { Gopher } from '../enemies/gopher.js';
import { SpinningTop } from '../enemies/spinningTop.js';
import { Letter } from '../enemies/letter.js';
import { Cowboy } from '../enemies/cowboy.js';
import { Controller } from '../enemies/controller.js';
import { Heart } from '../enemies/heart.js';
import { Clock } from '../enemies/clock.js';

const ENEMY_CLASSES = {
  bat: Bat,
  gopher: Gopher,
  spinningTop: SpinningTop,
  letter: Letter,
  cowboy: Cowboy,
  controller: Controller,
  heart: Heart,
  clock: Clock,
};

function getAvailableTypes(levelDepth) {
  const types = ['bat', 'gopher'];
  if (levelDepth >= 5) types.push('spinningTop', 'letter');
  if (levelDepth >= 9) types.push('cowboy', 'controller');
  return types;
}

function getDifficulty(levelDepth) {
  return 1 + (levelDepth - 1) * 0.08;
}

const SPAWN_MARGIN = 0.1;
const MIN_DIST_FROM_PLAYER = 120;
const MIN_DIST_FROM_OBJECTS = 80;
const MIN_DIST_BETWEEN_ENEMIES = 64;
const HEART_CHANCE = 0.20;
const CLOCK_CHANCE = 0.30;
const THEMED_CHANCE = 0.15;
const THEMED_RATIO = 0.75;

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Determine enemy count for a room based on level depth.
 * Starting room gets fewer enemies.
 */
function getEnemyCount(levelDepth, isStartRoom) {
  const extra = Math.floor((levelDepth - 1) / 5);
  if (isStartRoom) {
    return Math.min(1 + extra, 4);
  }
  return Math.min(2 + extra, 6);
}

/**
 * Pick `count` enemy types. If themed, 75% are the theme type.
 */
function pickEnemyTypes(count, themeType, availableTypes) {
  const types = [];
  for (let i = 0; i < count; i++) {
    if (themeType && Math.random() < THEMED_RATIO) {
      types.push(themeType);
    } else {
      types.push(availableTypes[Math.floor(Math.random() * availableTypes.length)]);
    }
  }
  return types;
}

/**
 * Find a valid spawn position within the room's floor area.
 * Respects distance constraints from avoidPoints and occupied positions.
 * Returns { x, y }.
 */
function findSpawnPosition(room, occupied, avoidPoints) {
  const maxRetries = 30;
  let bestPos = null;
  let bestMinDist = -1;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rx = SPAWN_MARGIN + Math.random() * (1 - 2 * SPAWN_MARGIN);
    const ry = SPAWN_MARGIN + Math.random() * (1 - 2 * SPAWN_MARGIN);
    const pos = room.spawnToWorld(rx, ry);

    let minDist = Infinity;
    let valid = true;

    // Check distance from avoid points (player, key, generators)
    for (const ap of avoidPoints) {
      const dx = pos.x - ap.x;
      const dy = pos.y - ap.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const threshold = ap.isPlayer ? MIN_DIST_FROM_PLAYER : MIN_DIST_FROM_OBJECTS;
      if (dist < threshold) {
        valid = false;
      }
      minDist = Math.min(minDist, dist);
    }

    // Check distance from already-occupied positions
    for (const occ of occupied) {
      const dx = pos.x - occ.x;
      const dy = pos.y - occ.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MIN_DIST_BETWEEN_ENEMIES) {
        valid = false;
      }
      minDist = Math.min(minDist, dist);
    }

    if (valid) return pos;

    // Track best-effort fallback (farthest from all constraints)
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      bestPos = pos;
    }
  }

  // Fallback: use the best position found
  return bestPos;
}

// ── Main API ─────────────────────────────────────────────────────────────

/**
 * Spawn enemies for the entire level.
 *
 * @param {import('./level.js').Level} level
 * @param {number} levelDepth
 * @param {object} options
 * @param {{ x: number, y: number }} options.playerStart
 * @param {{ x: number, y: number } | null} options.keyPosition
 * @param {Array<{ x: number, y: number }>} options.generators
 * @returns {import('../enemies/enemy.js').Enemy[]}
 */
export function spawnEnemies(level, levelDepth, options) {
  const { playerStart, keyPosition, generators } = options;
  const enemies = [];

  const availableTypes = getAvailableTypes(levelDepth);
  const difficulty = getDifficulty(levelDepth);

  // Decide themed level
  const isThemed = Math.random() < THEMED_CHANCE;
  const themeType = isThemed
    ? availableTypes[Math.floor(Math.random() * availableTypes.length)]
    : null;

  // Build avoid-points list (player, key, generators)
  const baseAvoidPoints = [{ x: playerStart.x, y: playerStart.y, isPlayer: true }];
  if (keyPosition) {
    baseAvoidPoints.push({ x: keyPosition.x, y: keyPosition.y });
  }
  for (const gen of generators) {
    baseAvoidPoints.push({ x: gen.x, y: gen.y });
  }

  // Spawn regular enemies per room
  for (let roomIdx = 0; roomIdx < level.rooms.length; roomIdx++) {
    const room = level.rooms[roomIdx];
    const isStartRoom = roomIdx === level.startRoomIndex;
    const count = getEnemyCount(levelDepth, isStartRoom);
    const types = pickEnemyTypes(count, themeType, availableTypes);
    const occupied = [];

    // Avoid points that are relevant to this room
    const avoidPoints = baseAvoidPoints.filter(ap => _isPointInRoom(ap, room));

    for (const type of types) {
      const pos = findSpawnPosition(room, occupied, avoidPoints);
      const EnemyClass = ENEMY_CLASSES[type];
      const enemy = new EnemyClass({ x: pos.x, y: pos.y, enemyType: type, difficulty });

      if (type === 'gopher') {
        enemy.roomBounds = {
          x: room.floorX, y: room.floorY,
          width: room.floorWidth, height: room.floorHeight,
        };
      }

      enemies.push(enemy);
      occupied.push(pos);
    }
  }

  // Heart — 20% chance, max 1 per level, spawned near hallway exit in starting room
  if (Math.random() < HEART_CHANCE) {
    const heart = _spawnHeart(level, enemies, difficulty);
    if (heart) enemies.push(heart);
  }

  // Clock — 30% chance, max 1 per level, random non-start room
  if (Math.random() < CLOCK_CHANCE && level.rooms.length > 1) {
    const clock = _spawnClock(level, enemies, baseAvoidPoints, difficulty);
    if (clock) enemies.push(clock);
  }

  return enemies;
}

/**
 * Spawn a single random enemy for Challenge/Boss trickle waves.
 *
 * @param {import('./room.js').Room} room
 * @param {import('../enemies/enemy.js').Enemy[]} existingEnemies
 * @param {{ playerPos: { x: number, y: number } }} options
 * @returns {import('../enemies/enemy.js').Enemy}
 */
export function spawnChallengeEnemy(room, existingEnemies, options) {
  const levelDepth = options.levelDepth || 1;
  const availableTypes = getAvailableTypes(levelDepth);
  const difficulty = getDifficulty(levelDepth);
  const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  const occupied = existingEnemies
    .filter(e => e.active)
    .map(e => ({ x: e.x, y: e.y }));
  const avoidPoints = [{ x: options.playerPos.x, y: options.playerPos.y, isPlayer: true }];

  const pos = findSpawnPosition(room, occupied, avoidPoints);
  const EnemyClass = ENEMY_CLASSES[type];
  const enemy = new EnemyClass({ x: pos.x, y: pos.y, enemyType: type, difficulty });

  if (type === 'gopher') {
    enemy.roomBounds = {
      x: room.floorX, y: room.floorY,
      width: room.floorWidth, height: room.floorHeight,
    };
  }

  return enemy;
}

// ── Internal helpers ─────────────────────────────────────────────────────

function _isPointInRoom(point, room) {
  return point.x >= room.floorX && point.x <= room.floorX + room.floorWidth
      && point.y >= room.floorY && point.y <= room.floorY + room.floorHeight;
}

/**
 * Spawn a Heart near the hallway exit in the starting room, with pathfinding
 * to the farthest room.
 */
function _spawnHeart(level, existingEnemies, difficulty) {
  const startRoom = level.rooms[level.startRoomIndex];
  const farthestRoomIndex = level.getFarthestRoom(level.startRoomIndex);
  const path = level.findPath(level.startRoomIndex, farthestRoomIndex);

  let x, y;
  let placed = false;

  if (path.length > 0) {
    const hw = path[0]; // first waypoint = hallway midpoint
    for (const h of level.hallways) {
      const hmx = h.floor.x + h.floor.w / 2;
      const hmy = h.floor.y + h.floor.h / 2;
      if (Math.abs(hmx - hw.x) < 1 && Math.abs(hmy - hw.y) < 1) {
        const opening = h.openings.find(o => o.roomIndex === level.startRoomIndex);
        if (opening) {
          const oc = (opening.start + opening.end) / 2;
          const margin = 32;
          if (opening.side === 'right') {
            x = startRoom.floorX + startRoom.floorWidth - margin;
            y = oc;
          } else if (opening.side === 'left') {
            x = startRoom.floorX + margin;
            y = oc;
          } else if (opening.side === 'bottom') {
            x = oc;
            y = startRoom.floorY + startRoom.floorHeight - margin;
          } else if (opening.side === 'top') {
            x = oc;
            y = startRoom.floorY + margin;
          }
          placed = true;
        }
        break;
      }
    }
  }

  if (!placed) {
    x = startRoom.floorX + startRoom.floorWidth / 2;
    y = startRoom.floorY + startRoom.floorHeight / 2;
  }

  const heart = new Heart({ x, y, enemyType: 'heart', difficulty });
  heart.setPath(path);
  return heart;
}

/**
 * Spawn a Clock in a random non-start room.
 */
function _spawnClock(level, existingEnemies, avoidPoints, difficulty) {
  // Pick random non-start room
  const candidates = [];
  for (let i = 0; i < level.rooms.length; i++) {
    if (i !== level.startRoomIndex) candidates.push(i);
  }
  if (candidates.length === 0) return null;

  const roomIdx = candidates[Math.floor(Math.random() * candidates.length)];
  const room = level.rooms[roomIdx];

  const occupied = existingEnemies
    .filter(e => e.active !== false)
    .map(e => ({ x: e.x, y: e.y }));
  const roomAvoidPoints = avoidPoints.filter(ap => _isPointInRoom(ap, room));

  const pos = findSpawnPosition(room, occupied, roomAvoidPoints);
  return new Clock({ x: pos.x, y: pos.y, enemyType: 'clock', difficulty });
}
