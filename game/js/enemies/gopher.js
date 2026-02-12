import { Enemy } from './enemy.js';
import { resolveWallCollision } from '../collision.js';

// ── Tuning constants ───────────────────────────────────────────────────
const EMERGE_DURATION   = 0.4;   // seconds (rising animation)
const IDLE_DURATION     = 1.0;   // seconds (sitting still after firing)
const BURROW_DURATION   = 0.6;   // seconds (burrowing animation)
const UNDERGROUND_MIN   = 1.5;   // min time underground
const UNDERGROUND_MAX   = 3.0;   // max time underground
const BULLET_SPEED      = 120;   // px/s
const BULLET_COUNT      = 8;
const BULLET_COLOR      = '#8b6914';
const SPAWN_MARGIN      = 0.1;   // keep away from room edges (0–1)
const BURROW_GRACE      = 0.15;  // seconds after burrowing where QTE still works

export class Gopher extends Enemy {
  constructor({ x = 0, y = 0, difficulty = 1.0 } = {}) {
    super({ x, y, enemyType: 'gopher', difficulty });

    this._bulletSpeed = BULLET_SPEED * this.difficulty;
    this._undergroundMin = Math.max(0.5, UNDERGROUND_MIN / this.difficulty);
    this._undergroundMax = Math.max(0.5, UNDERGROUND_MAX / this.difficulty);
    this.undergroundTimer = 0;
    this.undergroundDuration = _rand(this._undergroundMin, this._undergroundMax);
    this.roomBounds = null; // set externally after spawn
    this.hasFired = false;
    this.burrowGrace = 0;  // grace timer — hittable briefly after going underground
    this.setState('underground');
  }

  // ── QTE gate ──────────────────────────────────────────────────────────

  get canTriggerQTE() {
    if (!this.active || this.state === 'stunned') return false;
    // Hittable while burrowing and for a brief grace period after going underground
    if (this.state === 'underground') return this.burrowGrace > 0;
    return true;
  }

  get isAnticipating() {
    return this.state === 'emerging';
  }

  // ── State hooks ───────────────────────────────────────────────────────

  onStateEnter(state) {
    if (state === 'underground') {
      this.undergroundDuration = _rand(this._undergroundMin, this._undergroundMax);
      this.burrowGrace = BURROW_GRACE;
      // Teleport now so the dirt indicator shows at the correct spot
      if (this.roomBounds) {
        const m = SPAWN_MARGIN;
        const rx = m + Math.random() * (1 - 2 * m);
        const ry = m + Math.random() * (1 - 2 * m);
        this.x = this.roomBounds.x + rx * this.roomBounds.width;
        this.y = this.roomBounds.y + ry * this.roomBounds.height;
      }
    } else if (state === 'fire') {
      this.hasFired = false;
    }
  }

  resetToIdle() {
    this.setState('underground');
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt, walls, player, bullets) {
    if (!this.active) return;
    this.stateTimer += dt;
    this._updateKnockback(dt);
    this._updateScale(dt);

    switch (this.state) {
      case 'underground': this._underground(dt); break;
      case 'emerging':    this._emerging(dt);    break;
      case 'fire':        this._fire(dt, bullets); break;
      case 'idle':        this._idle(dt);        break;
      case 'burrowing':   this._burrowing(dt);   break;
    }

    if (walls) {
      resolveWallCollision(this, walls);
    }
  }

  _underground(dt) {
    if (this.burrowGrace > 0) this.burrowGrace -= dt;

    if (this.stateTimer >= this.undergroundDuration) {
      this.setState('emerging');
    }
  }

  _emerging(dt) {
    if (this.stateTimer >= EMERGE_DURATION) {
      this.setState('fire');
    }
  }

  _fire(dt, bullets) {
    // Fire on the first frame of this state
    if (!this.hasFired && bullets) {
      this.hasFired = true;
      for (let i = 0; i < BULLET_COUNT; i++) {
        const angle = (i / BULLET_COUNT) * Math.PI * 2;
        bullets.spawn({
          x: this.x,
          y: this.y,
          vx: Math.cos(angle) * this._bulletSpeed,
          vy: Math.sin(angle) * this._bulletSpeed,
          color: BULLET_COLOR,
        });
      }
    }
    // Immediately transition to idle after firing
    this.setState('idle');
  }

  _idle(dt) {
    if (this.stateTimer >= IDLE_DURATION) {
      this.setState('burrowing');
    }
  }

  _burrowing(dt) {
    if (this.stateTimer >= BURROW_DURATION) {
      this.setState('underground');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    switch (this.state) {
      case 'underground':
        // Not visible — optionally show a small dirt indicator
        this._renderDirtIndicator(ctx);
        break;

      case 'emerging': {
        // Scale Y from 0→1 over EMERGE_DURATION
        const t = Math.min(this.stateTimer / EMERGE_DURATION, 1);
        const w = this.width;
        const h = this.height * t;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - w / 2, this.y + this.height / 2 - h, w, h);
        this._renderAnticipation(ctx, w, h);
        break;
      }

      case 'burrowing': {
        // Scale Y from 1→0 over BURROW_DURATION
        const t = Math.min(this.stateTimer / BURROW_DURATION, 1);
        const w = this.width;
        const h = this.height * (1 - t);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - w / 2, this.y + this.height / 2 - h, w, h);
        break;
      }

      default:
        // fire / idle — render normally
        super.render(ctx);
        break;
    }
  }

  _renderDirtIndicator(ctx) {
    // Small brown circle on the ground where the gopher will emerge
    // Only show in the last 0.3s before emerging
    const timeLeft = this.undergroundDuration - this.stateTimer;
    if (timeLeft > 0.3) return;

    const pulse = 0.4 + 0.6 * Math.sin(this.stateTimer * 15);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = pulse * 0.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function _rand(min, max) {
  return min + Math.random() * (max - min);
}
