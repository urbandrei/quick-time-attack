import { Enemy } from './enemy.js';
import { resolveWallCollision } from '../collision.js';

// ── Tuning constants ───────────────────────────────────────────────────
const IDLE_MIN         = 1.5;   // min rest before winding (seconds)
const IDLE_MAX         = 2.5;   // max rest
const WINDUP_DURATION  = 0.8;   // wobble animation before firing
const FIRE_DURATION    = 2.0;   // spiral shooting phase
const TOPPLE_DURATION  = 1.0;   // fallen over, resting
const FIRE_INTERVAL    = 0.1;   // one bullet every 0.1s
const ROTATION_STEP    = Math.PI / 12; // 15° per shot
const BULLET_SPEED     = 100;   // px/s
const BULLET_COLOR     = '#ff4444';

export class SpinningTop extends Enemy {
  constructor({ x = 0, y = 0, difficulty = 1.0 } = {}) {
    super({ x, y, enemyType: 'spinningTop', difficulty });

    this._bulletSpeed = BULLET_SPEED * this.difficulty;
    this._fireInterval = Math.max(0.04, FIRE_INTERVAL / this.difficulty);
    this.idleDuration = _rand(IDLE_MIN, IDLE_MAX);
    this.fireAngle = Math.random() * Math.PI * 2; // start at random angle
    this.fireTimer = 0;
    this.setState('idle');
  }

  // ── QTE gate ──────────────────────────────────────────────────────────

  get canTriggerQTE() {
    return this.active && this.state !== 'stunned' && !this.falling && !this.justLanded;
  }

  get isAnticipating() {
    return this.state === 'winding';
  }

  // ── State hooks ───────────────────────────────────────────────────────

  onStateEnter(state) {
    if (state === 'idle') {
      this.idleDuration = _rand(IDLE_MIN, IDLE_MAX);
    } else if (state === 'firing') {
      this.fireTimer = 0;
    }
  }

  resetToIdle() {
    this.setState('idle');
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt, walls, player, bullets) {
    if (!this.active) return;
    if (this.falling) {
      this.fallTimer += dt;
      if (this.fallTimer >= this.fallDuration) {
        this.falling = false;
        this.justLanded = true;
      }
      return;
    }
    this.stateTimer += dt;
    this._updateKnockback(dt);
    this._updateScale(dt);

    switch (this.state) {
      case 'idle':     this._idle(dt);              break;
      case 'winding':  this._winding(dt);           break;
      case 'firing':   this._firing(dt, bullets);   break;
      case 'toppling': this._toppling(dt);          break;
    }

    if (walls) {
      resolveWallCollision(this, walls);
    }
  }

  _idle(dt) {
    if (this.stateTimer >= this.idleDuration) {
      this.setState('winding');
    }
  }

  _winding(dt) {
    if (this.stateTimer >= WINDUP_DURATION) {
      this.setState('firing');
    }
  }

  _firing(dt, bullets) {
    this.fireTimer += dt;
    while (this.fireTimer >= this._fireInterval && bullets) {
      this.fireTimer -= this._fireInterval;
      bullets.spawn({
        x: this.x,
        y: this.y,
        vx: Math.cos(this.fireAngle) * this._bulletSpeed,
        vy: Math.sin(this.fireAngle) * this._bulletSpeed,
        color: BULLET_COLOR,
      });
      this.fireAngle += ROTATION_STEP;
    }
    if (this.stateTimer >= FIRE_DURATION) {
      this.setState('toppling');
    }
  }

  _toppling(dt) {
    if (this.stateTimer >= TOPPLE_DURATION) {
      this.setState('idle');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    if (this.falling) { this._renderFalling(ctx); return; }
    switch (this.state) {
      case 'winding': {
        // Wobble effect — oscillate rotation to telegraph the attack
        const t = this.stateTimer / WINDUP_DURATION;
        const wobble = Math.sin(this.stateTimer * 20) * 0.2 * t;
        const cx = this.x;
        const cy = this.y;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(wobble);
        ctx.fillStyle = this._getColor();
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
        this._renderAnticipation(ctx, this.width, this.height);
        break;
      }

      case 'firing': {
        // Rotate the square visually to show it's spinning
        const angle = this.stateTimer * 8; // fast rotation
        const cx = this.x;
        const cy = this.y;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillStyle = this._getColor();
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
        break;
      }

      case 'toppling': {
        // Squash horizontally (wide + short) to show it fell over
        const t = Math.min(this.stateTimer / TOPPLE_DURATION, 1);
        const scaleX = 1 + 0.5 * (1 - t); // 1.5 → 1
        const scaleY = 1 - 0.4 * (1 - t); // 0.6 → 1
        const w = this.width * scaleX;
        const h = this.height * scaleY;
        ctx.fillStyle = this._getColor();
        ctx.fillRect(this.x - w / 2, this.y - h / 2, w, h);
        break;
      }

      default: {
        // idle — render with gentle tilt wobble
        const wobble = Math.sin(this.stateTimer * 3) * 0.06;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(wobble);
        ctx.fillStyle = this._getColor();
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
        break;
      }
    }
  }
}

function _rand(min, max) {
  return min + Math.random() * (max - min);
}
