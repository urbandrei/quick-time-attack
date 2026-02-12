import { Entity } from './entity.js';
import { checkCircleVsAABB } from './collision.js';
import { audio } from './systems/audio.js';

export const BULLET_RADIUS = 5;
const SOFT_CAP = 200;
const FADE_DURATION = 0.3; // seconds for soft-cap fade-out

export class Bullet extends Entity {
  constructor() {
    super({ width: BULLET_RADIUS * 2, height: BULLET_RADIUS * 2, color: '#ff4444' });
    this.radius = BULLET_RADIUS;
    this.vx = 0;
    this.vy = 0;
    this.lifetime = 0;
    this.maxLifetime = 5;
    this.active = false;
    this.alpha = 1;
    this.fading = false;
    this.fadeTimer = 0;
  }

  /** Activate this bullet with the given parameters. */
  init({ x, y, vx, vy, color = '#ff4444', radius = BULLET_RADIUS, lifetime = 5 }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = '#ff4444';
    this.radius = radius;
    this.width = radius * 2;
    this.height = radius * 2;
    this.lifetime = 0;
    this.maxLifetime = lifetime;
    this.active = true;
    this.alpha = 1;
    this.fading = false;
    this.fadeTimer = 0;
  }

  update(dt) {
    if (!this.active) return;

    // Move
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Age
    this.lifetime += dt;
    if (this.lifetime >= this.maxLifetime) {
      this.active = false;
      return;
    }

    // Fade out
    if (this.fading) {
      this.fadeTimer += dt;
      this.alpha = Math.max(0, 1 - this.fadeTimer / FADE_DURATION);
      if (this.alpha <= 0) {
        this.active = false;
      }
    }
  }

  /**
   * Check wall collision. Returns wall-hit info or null.
   * Deactivates bullet on hit.
   */
  checkWalls(walls) {
    if (!this.active) return null;
    for (const wall of walls) {
      const result = checkCircleVsAABB(this.x, this.y, this.radius, wall);
      if (result.overlaps) {
        this.active = false;
        // Compute normal: direction from wall center to bullet
        const wcx = wall.x + wall.w / 2;
        const wcy = wall.y + wall.h / 2;
        let nx = this.x - wcx;
        let ny = this.y - wcy;
        const len = Math.sqrt(nx * nx + ny * ny);
        if (len > 0) { nx /= len; ny /= len; } else { nx = 0; ny = -1; }
        return { x: this.x, y: this.y, nx, ny };
      }
    }
    return null;
  }

  /** Start the soft-cap fade-out. */
  startFade() {
    if (this.fading) return;
    this.fading = true;
    this.fadeTimer = 0;
  }

  render(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;

    // Stretch along velocity direction
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > 1) {
      const angle = Math.atan2(this.vy, this.vx);
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      ctx.scale(1.5, 0.7); // elongate along velocity, compress perpendicular
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Stationary bullets stay circular
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export class BulletPool {
  constructor(initialSize = 256) {
    this.pool = [];
    this.wallHits = [];
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new Bullet());
    }
  }

  /** Spawn a bullet. Returns the bullet instance (or null if pool somehow fails). */
  spawn(opts) {
    // Find an inactive bullet to reuse
    let bullet = null;
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        bullet = this.pool[i];
        break;
      }
    }

    // If none available, grow the pool
    if (!bullet) {
      bullet = new Bullet();
      this.pool.push(bullet);
    }

    bullet.init(opts);
    audio.playSFX('bulletFire', opts.x, opts.y);
    return bullet;
  }

  /** Update all active bullets. Check wall collision and enforce soft cap. */
  update(dt, walls) {
    const active = [];
    this.wallHits = [];

    for (let i = 0; i < this.pool.length; i++) {
      const b = this.pool[i];
      if (!b.active) continue;

      b.update(dt);
      if (!b.active) continue;

      const hit = b.checkWalls(walls);
      if (hit) {
        this.wallHits.push(hit);
        continue;
      }

      active.push(b);
    }

    // Enforce soft cap: mark oldest non-fading bullets for fade-out
    if (active.length > SOFT_CAP) {
      // Sort by lifetime descending (oldest first)
      active.sort((a, b) => b.lifetime - a.lifetime);
      const excess = active.length - SOFT_CAP;
      for (let i = 0; i < excess; i++) {
        active[i].startFade();
      }
    }
  }

  /** Render all active bullets. */
  render(ctx) {
    for (let i = 0; i < this.pool.length; i++) {
      const b = this.pool[i];
      if (b.active) b.render(ctx);
    }
  }

  /**
   * Destroy all active bullets within a radius of (cx, cy).
   * @returns {number} Count of bullets destroyed.
   */
  destroyInRadius(cx, cy, radius) {
    const r2 = radius * radius;
    let count = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const b = this.pool[i];
      if (!b.active) continue;
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy <= r2) {
        b.active = false;
        count++;
      }
    }
    return count;
  }

  /** Count of currently active bullets. */
  get activeCount() {
    let count = 0;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) count++;
    }
    return count;
  }
}
