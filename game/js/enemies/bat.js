import { Enemy } from './enemy.js';
import { resolveWallCollision } from '../collision.js';
import { audio } from '../systems/audio.js';

// ── Tuning constants ───────────────────────────────────────────────────
const BAT_SPEED         = 100;   // px/s during flutter
const LUNGE_SPEED_MULT  = 3;     // lunge speed = base × this
const FLUTTER_MIN       = 2;     // min seconds before winding up
const FLUTTER_MAX       = 4;     // max seconds before winding up
const WINDUP_DURATION   = 0.5;   // seconds of wind-up pause
const LUNGE_MAX_DIST    = 250;   // px — max travel before returning to flutter
const DIR_CHANGE_MIN    = 0.4;   // seconds between random direction changes
const DIR_CHANGE_MAX    = 1.2;
const LUNGE_RADIUS      = 12;    // collision radius during lunge

// Color transition
const BASE_COLOR   = '#8855cc';  // purple
const DANGER_COLOR = '#e74c3c';  // red
const COLOR_FADE_BACK = 0.3;     // seconds to fade from red → purple after lunge

export class Bat extends Enemy {
  constructor({ x = 0, y = 0, difficulty = 1.0 } = {}) {
    super({ x, y, enemyType: 'bat', difficulty });

    this.speed = BAT_SPEED * this.difficulty;
    this.lungeRadius = LUNGE_RADIUS;

    // Flutter direction
    this.moveAngle = Math.random() * Math.PI * 2;
    this.dirChangeTimer = 0;
    this.nextDirChange = _rand(DIR_CHANGE_MIN, DIR_CHANGE_MAX);

    // Timing for flutter → windup transition
    this.flutterDuration = _rand(FLUTTER_MIN, FLUTTER_MAX);

    // Lunge tracking
    this.lungeVx = 0;
    this.lungeVy = 0;
    this.lungeTraveled = 0;

    // Color fade-back timer (starts when exiting lunge)
    this._colorFadeTimer = COLOR_FADE_BACK; // start fully faded

    this.setState('flutter');
  }

  // ── QTE gate ──────────────────────────────────────────────────────────

  get canTriggerQTE() {
    return this.active && this.state !== 'lunge' && this.state !== 'stunned';
  }

  /** True while the bat is a projectile (damages player on contact). */
  get isLunging() {
    return this.state === 'lunge';
  }

  get isAnticipating() {
    return this.state === 'windup';
  }

  // ── State hooks ───────────────────────────────────────────────────────

  onStateEnter(state) {
    if (state === 'flutter') {
      this.flutterDuration = _rand(FLUTTER_MIN, FLUTTER_MAX);
      this.moveAngle = Math.random() * Math.PI * 2;
      this.dirChangeTimer = 0;
      this.nextDirChange = _rand(DIR_CHANGE_MIN, DIR_CHANGE_MAX);
      this._colorFadeTimer = 0; // start fading back from red
    } else if (state === 'lunge') {
      this.lungeTraveled = 0;
      audio.playSFX('batLunge', this.x, this.y);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────

  resetToIdle() {
    this.setState('flutter');
  }

  update(dt, walls, player, bullets) {
    if (!this.active) return;
    this.stateTimer += dt;
    this._updateKnockback(dt);
    this._updateScale(dt);

    // Tick color fade-back timer during flutter
    if (this.state === 'flutter' && this._colorFadeTimer < COLOR_FADE_BACK) {
      this._colorFadeTimer += dt;
    }

    switch (this.state) {
      case 'flutter': this._flutter(dt, walls); break;
      case 'windup':  this._windup(dt, player); break;
      case 'lunge':   this._lunge(dt, walls);   break;
    }
  }

  _flutter(dt, walls) {
    // Periodically change direction for chaotic movement
    this.dirChangeTimer += dt;
    if (this.dirChangeTimer >= this.nextDirChange) {
      this.moveAngle = Math.random() * Math.PI * 2;
      this.dirChangeTimer = 0;
      this.nextDirChange = _rand(DIR_CHANGE_MIN, DIR_CHANGE_MAX);
    }

    // Move
    this.x += Math.cos(this.moveAngle) * this.speed * dt;
    this.y += Math.sin(this.moveAngle) * this.speed * dt;

    // Wall collision — pick new direction on bounce
    if (walls) {
      const preX = this.x;
      const preY = this.y;
      resolveWallCollision(this, walls);
      if (this.x !== preX || this.y !== preY) {
        this.moveAngle = Math.random() * Math.PI * 2;
      }
    }

    // Time to wind up?
    if (this.stateTimer >= this.flutterDuration) {
      this.setState('windup');
    }
  }

  _windup(dt, player) {
    if (this.stateTimer >= WINDUP_DURATION && player) {
      // Aim at player's current position
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const lungeSpeed = this.speed * LUNGE_SPEED_MULT;

      if (dist > 0) {
        this.lungeVx = (dx / dist) * lungeSpeed;
        this.lungeVy = (dy / dist) * lungeSpeed;
      } else {
        this.lungeVx = lungeSpeed;
        this.lungeVy = 0;
      }

      this.setState('lunge');
    }
  }

  _lunge(dt, walls) {
    const mx = this.lungeVx * dt;
    const my = this.lungeVy * dt;

    this.x += mx;
    this.y += my;
    this.lungeTraveled += Math.sqrt(mx * mx + my * my);

    // Wall collision — end lunge on wall hit
    if (walls) {
      const preX = this.x;
      const preY = this.y;
      resolveWallCollision(this, walls);
      if (Math.abs(this.x - preX) > 0.1 || Math.abs(this.y - preY) > 0.1) {
        this.setState('flutter');
        return;
      }
    }

    // End lunge after max distance
    if (this.lungeTraveled >= LUNGE_MAX_DIST) {
      this.setState('flutter');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  // ── Color helpers ─────────────────────────────────────────────────────

  _getDrawColor() {
    switch (this.state) {
      case 'lunge':
        return DANGER_COLOR;
      case 'windup': {
        const t = Math.min(this.stateTimer / WINDUP_DURATION, 1);
        return _lerpColor(BASE_COLOR, DANGER_COLOR, t);
      }
      case 'flutter': {
        if (this._colorFadeTimer >= COLOR_FADE_BACK) return BASE_COLOR;
        const t = Math.min(this._colorFadeTimer / COLOR_FADE_BACK, 1);
        return _lerpColor(DANGER_COLOR, BASE_COLOR, t);
      }
      default:
        return BASE_COLOR;
    }
  }

  render(ctx) {
    const drawColor = this._getDrawColor();

    if (this.state === 'windup') {
      // Compress visual — wider and shorter to telegraph the lunge
      const t = Math.min(this.stateTimer / WINDUP_DURATION, 1);
      const w = this.width * (1 + t * 0.4);
      const h = this.height * (1 - t * 0.3);

      ctx.fillStyle = drawColor;
      ctx.fillRect(this.x - w / 2, this.y - h / 2, w, h);
      this._renderAnticipation(ctx, w, h);
    } else {
      // Render with computed color instead of this.color
      const w = this.width * this.scaleX;
      const h = this.height * this.scaleY;
      ctx.fillStyle = drawColor;
      ctx.fillRect(this.x - w / 2, this.y - h / 2, w, h);
    }
  }
}

function _rand(min, max) {
  return min + Math.random() * (max - min);
}

function _lerpColor(hexA, hexB, t) {
  const a = _hexToRgb(hexA);
  const b = _hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function _hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
