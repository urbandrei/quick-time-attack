import { Enemy } from './enemy.js';
import { resolveWallCollision } from '../collision.js';

// ── Tuning constants ───────────────────────────────────────────────────
const RUN_SPEED          = 120;  // px/s
const PREFERRED_DISTANCE = 200;  // px — tries to maintain this from player
const DISTANCE_TOLERANCE = 40;   // dead zone ±40px
const RUN_MIN            = 2.0;  // min seconds running before telegraph
const RUN_MAX            = 3.5;
const TELEGRAPH_DURATION = 0.6;  // seconds — visual wind-up
const COOLDOWN_DURATION  = 0.5;  // seconds — pause after firing
const BULLET_SPEED       = 200;  // px/s
const BULLET_COLOR       = '#ff4444';

export class Cowboy extends Enemy {
  constructor({ x = 0, y = 0, difficulty = 1.0 } = {}) {
    super({ x, y, enemyType: 'cowboy', difficulty });

    this._bulletSpeed = BULLET_SPEED * this.difficulty;
    this._runSpeed = RUN_SPEED * this.difficulty;
    this._telegraphDuration = Math.max(0.3, TELEGRAPH_DURATION / this.difficulty);
    this.bulletsRef = null;
    this.playerRef = null;
    this.runDuration = _randomRunDuration();
    this.setState('running');
  }

  // ── QTE gate ──────────────────────────────────────────────────────────

  get canTriggerQTE() {
    return this.active && this.state !== 'stunned';
  }

  get isAnticipating() {
    return this.state === 'telegraph';
  }

  resetToIdle() {
    this.runDuration = _randomRunDuration();
    this.setState('running');
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt, walls, player, bullets) {
    if (!this.active) return;
    this.stateTimer += dt;
    this._updateKnockback(dt);
    this._updateScale(dt);

    // Cache refs for use in onStateEnter
    this.bulletsRef = bullets;
    this.playerRef = player;

    switch (this.state) {
      case 'running':   this._running(dt, player); break;
      case 'telegraph': this._telegraph(dt);       break;
      case 'firing':    /* handled by onStateEnter */ break;
      case 'cooldown':  this._cooldown(dt);        break;
    }

    if (walls) {
      resolveWallCollision(this, walls);
    }
  }

  // ── State behaviors ───────────────────────────────────────────────────

  _running(dt, player) {
    if (!player) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let moveX = 0;
    let moveY = 0;

    if (dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;

      if (dist < PREFERRED_DISTANCE - DISTANCE_TOLERANCE) {
        // Too close — move away
        moveX = -nx;
        moveY = -ny;
      } else if (dist > PREFERRED_DISTANCE + DISTANCE_TOLERANCE) {
        // Too far — move toward
        moveX = nx;
        moveY = ny;
      } else {
        // In sweet spot — strafe perpendicular
        moveX = -ny;
        moveY = nx;
      }
    }

    this.x += moveX * this._runSpeed * dt;
    this.y += moveY * this._runSpeed * dt;

    if (this.stateTimer >= this.runDuration) {
      this.setState('telegraph');
    }
  }

  _telegraph(dt) {
    if (this.stateTimer >= this._telegraphDuration) {
      this.setState('firing');
    }
  }

  _cooldown(dt) {
    if (this.stateTimer >= COOLDOWN_DURATION) {
      this.runDuration = _randomRunDuration();
      this.setState('running');
    }
  }

  // ── State hooks ───────────────────────────────────────────────────────

  onStateEnter(state) {
    if (state === 'firing') {
      this._firePredictiveBullet();
      this.setState('cooldown');
    }
  }

  _firePredictiveBullet() {
    const player = this.playerRef;
    if (!this.bulletsRef || !player) return;

    // Vector from cowboy to player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Estimated travel time
    const t = dist / this._bulletSpeed;

    // Predicted position = current + velocity * time
    const predX = player.x + (player.vx || 0) * t;
    const predY = player.y + (player.vy || 0) * t;

    // Aim at predicted position
    const aimDx = predX - this.x;
    const aimDy = predY - this.y;
    const aimDist = Math.sqrt(aimDx * aimDx + aimDy * aimDy);
    const dirX = aimDist > 0 ? aimDx / aimDist : 1;
    const dirY = aimDist > 0 ? aimDy / aimDist : 0;

    this.bulletsRef.spawn({
      x: this.x,
      y: this.y,
      vx: dirX * this._bulletSpeed,
      vy: dirY * this._bulletSpeed,
      color: BULLET_COLOR,
      lifetime: 5,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    switch (this.state) {
      case 'telegraph': {
        // Pulsing scale + darker shade to show "reaching for holster"
        const t = Math.min(this.stateTimer / this._telegraphDuration, 1);
        const pulse = 1 + 0.15 * Math.sin(t * Math.PI * 4);
        const w = this.width * pulse;
        const h = this.height * pulse;

        ctx.fillStyle = '#a07850';
        ctx.fillRect(this.x - w / 2, this.y - h / 2, w, h);

        // Warning border
        const borderAlpha = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
        ctx.strokeStyle = `rgba(255, 255, 100, ${borderAlpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - w / 2, this.y - h / 2, w, h);
        this._renderAnticipation(ctx, w, h);
        break;
      }

      default:
        super.render(ctx);
        break;
    }
  }
}

function _randomRunDuration() {
  return RUN_MIN + Math.random() * (RUN_MAX - RUN_MIN);
}
