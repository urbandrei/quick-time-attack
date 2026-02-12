import { QTE } from './qte.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { audio } from '../systems/audio.js';
import {
  getGopherWhacks, getGopherPopDuration, getGopherPopInterval, getGopherMaxPops,
} from '../systems/difficulty.js';

// ── Tuning constants ────────────────────────────────────────────────────
const TIME_LIMIT    = 3;      // seconds (fallback)
const HOLE_COLS     = 3;
const HOLE_ROWS     = 3;
const HOLE_RADIUS   = 28;     // visual
const CLICK_RADIUS  = 36;     // click hitbox (generous)
const GOPHER_SIZE   = 24;     // px

// Grid layout
const GRID_WIDTH  = 300;
const GRID_HEIGHT = 240;
const GRID_X      = (CANVAS_WIDTH - GRID_WIDTH) / 2;
const GRID_Y      = (CANVAS_HEIGHT - GRID_HEIGHT) / 2 + 20; // offset down slightly

export class GopherQTE extends QTE {
  constructor({ enemy = null, timeLimit = TIME_LIMIT, levelDepth = 1 } = {}) {
    super({ timeLimit, enemy });

    this.hideEnemyLabel = true;
    this.whacked = 0;
    this.targetWhacks = getGopherWhacks(levelDepth);
    this.popDuration = getGopherPopDuration(levelDepth);
    this.popInterval = getGopherPopInterval(levelDepth);
    this.maxPops = getGopherMaxPops(levelDepth);
    this.totalPops = 0;
    this.popTimer = 0.2; // small delay before first pop

    // Build hole positions in a 3×3 grid
    this.holes = [];
    for (let row = 0; row < HOLE_ROWS; row++) {
      for (let col = 0; col < HOLE_COLS; col++) {
        this.holes.push({
          x: GRID_X + (col + 0.5) * (GRID_WIDTH / HOLE_COLS),
          y: GRID_Y + (row + 0.5) * (GRID_HEIGHT / HOLE_ROWS),
          active: false,
          timer: 0,
          whacked: false,  // brief flash on whack
          whackTimer: 0,
        });
      }
    }
  }

  update(dt) {
    super.update(dt);
    if (this.completed) return;

    // Pop timer — activate a random hole periodically (if pops remain)
    this.popTimer -= dt;
    if (this.popTimer <= 0) {
      this.popTimer = this.popInterval;
      if (this.totalPops < this.maxPops) {
        this._popRandomHole();
      }
    }

    // Update active holes
    for (const hole of this.holes) {
      if (hole.active) {
        hole.timer -= dt;
        if (hole.timer <= 0) {
          hole.active = false;
        }
      }
      if (hole.whacked) {
        hole.whackTimer -= dt;
        if (hole.whackTimer <= 0) {
          hole.whacked = false;
        }
      }
    }

    // Check mouse click
    if (input.isMouseJustPressed(0)) {
      const mouse = input.getMousePos();
      for (const hole of this.holes) {
        if (!hole.active) continue;
        const dx = mouse.x - hole.x;
        const dy = mouse.y - hole.y;
        if (dx * dx + dy * dy <= CLICK_RADIUS * CLICK_RADIUS) {
          hole.active = false;
          hole.whacked = true;
          hole.whackTimer = 0.15;
          this.whacked++;
          audio.playSFX('qteClick');
          if (this.whacked >= this.targetWhacks) {
            this.succeed();
          }
          break; // only one whack per click
        }
      }
    }
  }

  _popRandomHole() {
    // Collect inactive holes
    const inactive = this.holes.filter(h => !h.active);
    if (inactive.length === 0) return;

    const hole = inactive[Math.floor(Math.random() * inactive.length)];
    hole.active = true;
    hole.timer = this.popDuration;
    this.totalPops++;
  }

  render(ctx) {
    super.render(ctx); // timer bar

    // Instruction text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Whack the Gophers!', CANVAS_WIDTH / 2, 68);

    // Counter
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(`${this.whacked} / ${this.targetWhacks}`, CANVAS_WIDTH / 2, 90);

    // Draw holes
    for (const hole of this.holes) {
      // Dark hole background
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, HOLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Hole rim
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, HOLE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      if (hole.whacked) {
        // Brief flash on successful whack
        ctx.fillStyle = '#ffff44';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, HOLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (hole.active) {
        // Gopher popping up — draw as a colored square rising from the hole
        const popT = Math.min(1, (this.popDuration - hole.timer) / 0.15); // quick rise
        const halfSize = GOPHER_SIZE / 2;
        const yOffset = (1 - popT) * GOPHER_SIZE; // slides up from below

        const color = (this.enemy && this.enemy.color) || '#8b6914';
        ctx.fillStyle = color;
        ctx.fillRect(
          hole.x - halfSize,
          hole.y - halfSize + yOffset,
          GOPHER_SIZE,
          GOPHER_SIZE
        );

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(hole.x - 6, hole.y - 4 + yOffset, 4, 4);
        ctx.fillRect(hole.x + 2, hole.y - 4 + yOffset, 4, 4);
      }
    }
  }
}
