import { QTE } from './qte.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { audio } from '../systems/audio.js';

// ── Tuning constants ────────────────────────────────────────────────────
const TIME_LIMIT   = 3.5;   // seconds — slightly generous for a platformer
const TILE_SIZE    = 16;
const CHAR_SIZE    = 14;     // slightly smaller than a tile
const GRAVITY      = 825;    // px/s²
const JUMP_VEL     = -285;   // px/s (negative = up)
const MOVE_SPEED   = 210;    // px/s horizontal
const COYOTE_TIME  = 0.06;   // seconds — brief grace period after leaving edge

// Tile types
const AIR   = 0;
const SOLID = 1;
const SPIKE = 2;
const GOAL  = 3;

// Colors
const SOLID_COLOR  = '#555577';
const SPIKE_COLOR  = '#e74c3c';
const GOAL_COLOR   = '#44ff88';
const CHAR_COLOR   = '#00ffff';
const BG_COLOR     = '#1a1a2e';

// Play area — centered on canvas
const COLS = 28;
const ROWS = 10;
const AREA_W = COLS * TILE_SIZE;
const AREA_H = ROWS * TILE_SIZE;
const AREA_X = Math.floor((CANVAS_WIDTH - AREA_W) / 2);
const AREA_Y = Math.floor((CANVAS_HEIGHT - AREA_H) / 2) + 20; // nudge down for timer bar

// Hand-designed layouts (28×10 tile maps)
// '.' = air, '#' = solid, 'S' = spike, 'G' = goal, 'P' = player start
const LAYOUT_STRINGS = [
  // Layout 0
  [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '.....P................G.....',
    '....###...##....##...###....',
    '............................',
    '............................',
    '............................',
  ],
  // Layout 1
  [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '.....P..SS...SS...SS..G.....',
    '....####################....',
    '............................',
    '............................',
    '............................',
  ],
  // Layout 2
  [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '.....P................G.....',
    '....###.......#......###....',
    '............................',
    '............................',
    '............................',
  ],
  // Layout 3
  [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '................S...........',
    '...........S..###...........',
    '.....P...###.........G......',
    '....###.............###.....',
    '............................',
  ],
];

export class ControllerQTE extends QTE {
  constructor({ enemy = null, timeLimit = TIME_LIMIT } = {}) {
    super({ timeLimit, enemy });

    this.hideEnemyLabel = true;

    // Pick a random layout
    const layoutIndex = Math.floor(Math.random() * LAYOUT_STRINGS.length);
    this._parseLayout(LAYOUT_STRINGS[layoutIndex]);

    // Platformer character state
    this.charX = this.startX;
    this.charY = this.startY;
    this.charVx = 0;
    this.charVy = 0;
    this.onGround = false;
    this.coyoteTimer = 0;

    // Input tracking (held keys)
    this.keysHeld = { left: false, right: false, jump: false };
    this.jumpPressed = false; // single-frame jump trigger
  }

  _parseLayout(strings) {
    this.tiles = [];
    this.startX = 0;
    this.startY = 0;
    this.goalTiles = [];

    for (let row = 0; row < ROWS; row++) {
      this.tiles[row] = [];
      const line = strings[row] || '';
      for (let col = 0; col < COLS; col++) {
        const ch = line[col] || '.';
        switch (ch) {
          case '#':
            this.tiles[row][col] = SOLID;
            break;
          case 'S':
            this.tiles[row][col] = SPIKE;
            break;
          case 'G':
            this.tiles[row][col] = GOAL;
            this.goalTiles.push({ col, row });
            break;
          case 'P':
            this.tiles[row][col] = AIR;
            // Place character above this tile (feet on tile below)
            this.startX = col * TILE_SIZE + TILE_SIZE / 2;
            this.startY = row * TILE_SIZE + TILE_SIZE / 2;
            break;
          default:
            this.tiles[row][col] = AIR;
            break;
        }
      }
    }
  }

  onInput(event) {
    if (this.completed) return;

    // Track key state for held-movement
    const isDown = event.type === 'keydown';
    const isUp = event.type === 'keyup';
    if (!isDown && !isUp) return;

    switch (event.code) {
      case 'KeyA': case 'ArrowLeft':
        this.keysHeld.left = isDown;
        break;
      case 'KeyD': case 'ArrowRight':
        this.keysHeld.right = isDown;
        break;
      case 'KeyW': case 'ArrowUp': case 'Space':
        this.keysHeld.jump = isDown;
        if (isDown && !event.repeat) {
          this.jumpPressed = true;
          audio.playSFX('qteClick');
        }
        break;
    }
  }

  update(dt) {
    super.update(dt);
    if (this.completed) return;

    // Horizontal movement
    this.charVx = 0;
    if (this.keysHeld.left)  this.charVx -= MOVE_SPEED;
    if (this.keysHeld.right) this.charVx += MOVE_SPEED;

    // Jump (ground or coyote time)
    if (this.jumpPressed && (this.onGround || this.coyoteTimer > 0)) {
      this.charVy = JUMP_VEL;
      this.onGround = false;
      this.coyoteTimer = 0;
    }
    this.jumpPressed = false;

    // Gravity
    this.charVy += GRAVITY * dt;

    // Move X, then resolve
    this.charX += this.charVx * dt;
    this._resolveX();

    // Move Y, then resolve
    const wasOnGround = this.onGround;
    this.charY += this.charVy * dt;
    this._resolveY();

    // Coyote time tracking
    if (wasOnGround && !this.onGround && this.charVy >= 0) {
      this.coyoteTimer = COYOTE_TIME;
    }
    if (this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }

    // Check for falling off the map (below tile area)
    if (this.charY > ROWS * TILE_SIZE + CHAR_SIZE) {
      this.fail();
      return;
    }

    // Check spike collision
    if (this._checkTileCollision(SPIKE)) {
      this.fail();
      return;
    }

    // Check goal collision
    if (this._checkTileCollision(GOAL)) {
      this.succeed();
    }
  }

  // ── Collision resolution ──────────────────────────────────────────────

  _resolveX() {
    const half = CHAR_SIZE / 2;
    const left   = this.charX - half;
    const right  = this.charX + half;
    const top    = this.charY - half + 1; // slight inset to avoid corner snagging
    const bottom = this.charY + half - 1;

    // Check tiles the character overlaps
    const colL = Math.floor(left / TILE_SIZE);
    const colR = Math.floor(right / TILE_SIZE);
    const rowT = Math.floor(top / TILE_SIZE);
    const rowB = Math.floor(bottom / TILE_SIZE);

    for (let r = rowT; r <= rowB; r++) {
      for (let c = colL; c <= colR; c++) {
        if (this._getTile(r, c) !== SOLID) continue;

        const tileLeft = c * TILE_SIZE;
        const tileRight = tileLeft + TILE_SIZE;

        if (this.charVx > 0) {
          // Moving right — push left
          this.charX = tileLeft - half;
        } else if (this.charVx < 0) {
          // Moving left — push right
          this.charX = tileRight + half;
        }
        this.charVx = 0;
      }
    }

    // Clamp to play area
    this.charX = Math.max(half, Math.min(COLS * TILE_SIZE - half, this.charX));
  }

  _resolveY() {
    const half = CHAR_SIZE / 2;
    const left   = this.charX - half + 1; // slight inset
    const right  = this.charX + half - 1;
    const top    = this.charY - half;
    const bottom = this.charY + half;

    const colL = Math.floor(left / TILE_SIZE);
    const colR = Math.floor(right / TILE_SIZE);
    const rowT = Math.floor(top / TILE_SIZE);
    const rowB = Math.floor(bottom / TILE_SIZE);

    this.onGround = false;

    for (let r = rowT; r <= rowB; r++) {
      for (let c = colL; c <= colR; c++) {
        if (this._getTile(r, c) !== SOLID) continue;

        const tileTop = r * TILE_SIZE;
        const tileBottom = tileTop + TILE_SIZE;

        if (this.charVy > 0) {
          // Falling — land on top
          this.charY = tileTop - half;
          this.charVy = 0;
          this.onGround = true;
        } else if (this.charVy < 0) {
          // Jumping up — hit ceiling
          this.charY = tileBottom + half;
          this.charVy = 0;
        }
      }
    }
  }

  _getTile(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return AIR;
    return this.tiles[row][col];
  }

  _checkTileCollision(tileType) {
    const half = CHAR_SIZE / 2;
    // Shrink hitbox slightly for spike/goal checks (more forgiving)
    const margin = 3;
    const left   = this.charX - half + margin;
    const right  = this.charX + half - margin;
    const top    = this.charY - half + margin;
    const bottom = this.charY + half - margin;

    const colL = Math.floor(left / TILE_SIZE);
    const colR = Math.floor(right / TILE_SIZE);
    const rowT = Math.floor(top / TILE_SIZE);
    const rowB = Math.floor(bottom / TILE_SIZE);

    for (let r = rowT; r <= rowB; r++) {
      for (let c = colL; c <= colR; c++) {
        if (this._getTile(r, c) === tileType) return true;
      }
    }
    return false;
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    super.render(ctx); // timer bar

    // Instruction text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Reach the Goal!', CANVAS_WIDTH / 2, 68);

    ctx.save();
    ctx.translate(AREA_X, AREA_Y);

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, AREA_W, AREA_H);

    // Tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.tiles[r][c];
        const tx = c * TILE_SIZE;
        const ty = r * TILE_SIZE;

        switch (tile) {
          case SOLID:
            ctx.fillStyle = SOLID_COLOR;
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            // Subtle border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 0.5, ty + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
            break;

          case SPIKE:
            // Draw spike as a triangle on top of the tile
            ctx.fillStyle = SPIKE_COLOR;
            ctx.beginPath();
            ctx.moveTo(tx, ty + TILE_SIZE);
            ctx.lineTo(tx + TILE_SIZE / 2, ty + 2);
            ctx.lineTo(tx + TILE_SIZE, ty + TILE_SIZE);
            ctx.closePath();
            ctx.fill();
            break;

          case GOAL: {
            // Pulsing green marker
            const pulse = 0.6 + 0.4 * Math.sin(this.elapsed * 6);
            ctx.fillStyle = GOAL_COLOR;
            ctx.globalAlpha = pulse;
            ctx.fillRect(tx + 2, ty + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = GOAL_COLOR;
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 1, ty + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            break;
          }
        }
      }
    }

    // Character
    const half = CHAR_SIZE / 2;
    ctx.fillStyle = CHAR_COLOR;
    ctx.fillRect(this.charX - half, this.charY - half, CHAR_SIZE, CHAR_SIZE);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.charX - half, this.charY - half, CHAR_SIZE, CHAR_SIZE);

    ctx.restore();

    // Play area border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(AREA_X, AREA_Y, AREA_W, AREA_H);
  }
}
