import { Enemy } from './enemy.js';
import { resolveWallCollision } from '../collision.js';

// ── Tuning constants ───────────────────────────────────────────────────
const FLOAT_SPEED = 0.5;          // angular velocity for figure-8 (rad/s)
const FLOAT_AMPLITUDE_X = 60;     // horizontal range of figure-8
const FLOAT_AMPLITUDE_Y = 40;     // vertical range of figure-8
const BULLET_INTERVAL = 0.8;      // seconds between trail bullets
const BULLET_LIFETIME = 2.5;      // how long trail bullets persist
const BULLET_COLOR = '#ff4444';

export class Clock extends Enemy {
  constructor({ x = 0, y = 0, difficulty = 1.0 } = {}) {
    super({ x, y, enemyType: 'clock', difficulty });
    this._bulletInterval = Math.max(0.3, BULLET_INTERVAL / this.difficulty);
    this._bulletLifetime = BULLET_LIFETIME * Math.min(this.difficulty, 1.5);
    this.spawnX = x;
    this.spawnY = y;
    this.floatAngle = Math.random() * Math.PI * 2;
    this.bulletTimer = 0;
    this.setState('idle');
  }

  // ── QTE gate ──────────────────────────────────────────────────────────

  get canTriggerQTE() {
    return this.active && this.state !== 'stunned';
  }

  resetToIdle() {
    // Re-center figure-8 on current position after knockback
    this.spawnX = this.x;
    this.spawnY = this.y;
    this.setState('idle');
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt, walls, player, bullets) {
    if (!this.active) return;
    this.stateTimer += dt;
    this._updateKnockback(dt);
    this._updateScale(dt);

    if (this.state === 'idle') {
      // Figure-8 movement (lemniscate)
      this.floatAngle += FLOAT_SPEED * dt;
      this.x = this.spawnX + Math.sin(this.floatAngle) * FLOAT_AMPLITUDE_X;
      this.y = this.spawnY + Math.sin(this.floatAngle * 2) * FLOAT_AMPLITUDE_Y / 2;

      // Drop stationary bullet trail
      this.bulletTimer += dt;
      if (this.bulletTimer >= this._bulletInterval && bullets) {
        this.bulletTimer -= this._bulletInterval;
        bullets.spawn({
          x: this.x,
          y: this.y,
          vx: 0,
          vy: 0,
          color: BULLET_COLOR,
          lifetime: this._bulletLifetime,
        });
      }
    }

    if (walls) {
      resolveWallCollision(this, walls);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    // Gentle bob effect
    const bob = Math.sin(this.stateTimer * 3) * 2;
    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.x - this.width / 2,
      this.y - this.height / 2 + bob,
      this.width,
      this.height,
    );
  }
}
