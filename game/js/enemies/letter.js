import { Enemy } from './enemy.js';
import { resolveWallCollision } from '../collision.js';

// ── Tuning constants ───────────────────────────────────────────────────
const AIM_DURATION       = 1.0;   // seconds — telegraph: aiming at player
const TELEPORT_DURATION  = 0.3;   // seconds — brief pause at new position
const BULLET_SPEED       = 180;   // px/s — aimed shot
const BULLET_COLOR       = '#ff4444';
const AIM_LINE_LENGTH    = 40;    // px — visual telegraph line

export class Letter extends Enemy {
  constructor({ x = 0, y = 0, difficulty = 1.0 } = {}) {
    super({ x, y, enemyType: 'letter', difficulty });

    this._bulletSpeed = BULLET_SPEED * this.difficulty;
    this._aimDuration = Math.max(0.4, AIM_DURATION / this.difficulty);
    this.activeBullet = null;
    this.targetX = 0;
    this.targetY = 0;
    this.bulletsRef = null;
    this.setState('aiming');
  }

  // ── QTE gate ──────────────────────────────────────────────────────────

  get canTriggerQTE() {
    return this.active && this.state !== 'stunned';
  }

  get isAnticipating() {
    return this.state === 'aiming';
  }

  // ── State hooks ───────────────────────────────────────────────────────

  onStateEnter(state) {
    if (state === 'firing') {
      // Compute aim direction toward player's stored position
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dirX = dist > 0 ? dx / dist : 1;
      const dirY = dist > 0 ? dy / dist : 0;

      // Spawn bullet, store reference
      if (this.bulletsRef) {
        this.activeBullet = this.bulletsRef.spawn({
          x: this.x,
          y: this.y,
          vx: dirX * this._bulletSpeed,
          vy: dirY * this._bulletSpeed,
          color: BULLET_COLOR,
          lifetime: 10, // long lifetime — should hit wall first
        });
      }
      // Immediately transition to waiting
      this.setState('waiting');
    }
  }

  resetToIdle() {
    // Deactivate any in-flight bullet
    if (this.activeBullet && this.activeBullet.active) {
      this.activeBullet.active = false;
    }
    this.activeBullet = null;
    this.setState('aiming');
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt, walls, player, bullets) {
    if (!this.active) return;
    this.stateTimer += dt;
    this._updateKnockback(dt);
    this._updateScale(dt);

    // Store bullets reference for firing
    this.bulletsRef = bullets;

    switch (this.state) {
      case 'aiming':     this._aiming(dt, player); break;
      case 'waiting':    this._waiting(dt);         break;
      case 'teleporting': this._teleporting(dt);    break;
    }

    if (walls) {
      resolveWallCollision(this, walls);
    }
  }

  _aiming(dt, player) {
    // Track player position for firing
    if (player) {
      this.targetX = player.x;
      this.targetY = player.y;
    }

    if (this.stateTimer >= this._aimDuration) {
      this.setState('firing');
    }
  }

  _waiting(dt) {
    if (this.activeBullet && !this.activeBullet.active) {
      // Teleport to bullet's last position
      this.x = this.activeBullet.x;
      this.y = this.activeBullet.y;
      this.activeBullet = null;
      this.setState('teleporting');
    }
  }

  _teleporting(dt) {
    if (this.stateTimer >= TELEPORT_DURATION) {
      this.setState('aiming');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    switch (this.state) {
      case 'aiming': {
        // Normal square with float bob + aim line toward player
        const bob = Math.sin(this.stateTimer * 2.5) * 3;
        const w = this.width * this.scaleX;
        const h = this.height * this.scaleY;
        ctx.fillStyle = this._getColor();
        ctx.fillRect(this.x - w / 2, this.y - h / 2 + bob, w, h);
        this._renderAnticipation(ctx, w, h);

        // Telegraph line
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const dirX = dx / dist;
          const dirY = dy / dist;
          const pulse = 0.4 + 0.6 * Math.min(this.stateTimer / this._aimDuration, 1);

          ctx.strokeStyle = BULLET_COLOR;
          ctx.lineWidth = 2;
          ctx.globalAlpha = pulse;
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          ctx.lineTo(
            this.x + dirX * AIM_LINE_LENGTH,
            this.y + dirY * AIM_LINE_LENGTH
          );
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        break;
      }

      case 'teleporting': {
        // Brief flash/scale effect at new position
        const t = Math.min(this.stateTimer / TELEPORT_DURATION, 1);
        const scale = 1.4 - 0.4 * t; // shrink from 1.4 → 1.0
        const w = this.width * scale;
        const h = this.height * scale;

        ctx.fillStyle = this._getColor();
        ctx.globalAlpha = 0.5 + 0.5 * t; // fade in from 0.5 → 1.0
        ctx.fillRect(this.x - w / 2, this.y - h / 2, w, h);
        ctx.globalAlpha = 1;
        break;
      }

      default: {
        // firing / waiting — render with float bob
        const bob = Math.sin(this.stateTimer * 2.5) * 3;
        const w = this.width * this.scaleX;
        const h = this.height * this.scaleY;
        ctx.fillStyle = this._getColor();
        ctx.fillRect(this.x - w / 2, this.y - h / 2 + bob, w, h);
        break;
      }
    }
  }
}
