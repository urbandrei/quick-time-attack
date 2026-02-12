import { Enemy } from './enemy.js';
import { resolveWallCollision } from '../collision.js';

// ── Tuning constants ───────────────────────────────────────────────────
const SHOT_INTERVAL    = 2.0;  // seconds between shot cycles
const FLASH_DURATION   = 0.5;  // seconds — direction telegraph before firing
const BULLET_SPEED     = 160;  // px/s
const BULLET_COLOR     = '#ff4444';
const BOB_AMPLITUDE    = 4;    // px vertical sine bob
const BOB_FREQUENCY    = 2;    // cycles per second

// Cardinal directions (↑↓←→)
const CARDINAL = [
  { x:  0, y: -1 },
  { x:  0, y:  1 },
  { x: -1, y:  0 },
  { x:  1, y:  0 },
];
// Diagonal directions (↗↘↙↖)
const DIAGONAL = [
  { x:  0.7071, y: -0.7071 },
  { x:  0.7071, y:  0.7071 },
  { x: -0.7071, y:  0.7071 },
  { x: -0.7071, y: -0.7071 },
];

export class Controller extends Enemy {
  constructor({ x = 0, y = 0, difficulty = 1.0 } = {}) {
    super({ x, y, enemyType: 'controller', difficulty });

    this._bulletSpeed = BULLET_SPEED * this.difficulty;
    this._shotInterval = Math.max(0.8, SHOT_INTERVAL / this.difficulty);
    this.baseY = y;
    this.bobTimer = 0;
    this.bulletsRef = null;
    this.useCardinal = true; // alternates each shot cycle
    this.setState('idle');
  }

  // ── QTE gate ──────────────────────────────────────────────────────────

  get canTriggerQTE() {
    return this.active && this.state !== 'stunned';
  }

  get isAnticipating() {
    return this.state === 'flash';
  }

  resetToIdle() {
    this.setState('idle');
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt, walls, player, bullets) {
    if (!this.active) return;
    this.stateTimer += dt;
    this._updateKnockback(dt);
    this._updateScale(dt);

    this.bulletsRef = bullets;
    this.bobTimer += dt;

    // Subtle vertical bob
    this.y = this.baseY + Math.sin(this.bobTimer * BOB_FREQUENCY * Math.PI * 2) * BOB_AMPLITUDE;

    switch (this.state) {
      case 'idle':    this._idle(dt);    break;
      case 'flash':   this._flash(dt);   break;
      case 'firing':  /* handled by onStateEnter */ break;
    }

    if (walls) {
      resolveWallCollision(this, walls);
    }
  }

  // ── State behaviors ───────────────────────────────────────────────────

  _idle(dt) {
    if (this.stateTimer >= this._shotInterval) {
      this.setState('flash');
    }
  }

  _flash(dt) {
    if (this.stateTimer >= FLASH_DURATION) {
      this.setState('firing');
    }
  }

  // ── State hooks ───────────────────────────────────────────────────────

  onStateEnter(state) {
    if (state === 'firing') {
      this._fireBurst();
      this.useCardinal = !this.useCardinal; // alternate for next cycle
      this.setState('idle');
    }
  }

  _fireBurst() {
    if (!this.bulletsRef) return;

    const dirs = this.useCardinal ? CARDINAL : DIAGONAL;
    for (const dir of dirs) {
      this.bulletsRef.spawn({
        x: this.x,
        y: this.y,
        vx: dir.x * this._bulletSpeed,
        vy: dir.y * this._bulletSpeed,
        color: BULLET_COLOR,
        lifetime: 5,
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    switch (this.state) {
      case 'flash': {
        // Draw base square
        super.render(ctx);

        // Draw direction indicators — lines showing where bullets will go
        const dirs = this.useCardinal ? CARDINAL : DIAGONAL;
        const t = Math.min(this.stateTimer / FLASH_DURATION, 1);
        const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI * 4));
        const lineLen = 24;

        ctx.strokeStyle = BULLET_COLOR;
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha;

        for (const dir of dirs) {
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(this.x + dir.x * lineLen, this.y + dir.y * lineLen);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
        break;
      }

      default:
        super.render(ctx);
        break;
    }
  }
}
