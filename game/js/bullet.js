import { Entity } from './entity.js';
import { checkCircleVsAABB } from './collision.js';

export const BULLET_RADIUS = 3;
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
    this.color = color;
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

  /** Check wall collision. Returns true if bullet hit a wall and was deactivated. */
  checkWalls(walls) {
    if (!this.active) return false;
    for (const wall of walls) {
      const result = checkCircleVsAABB(this.x, this.y, this.radius, wall);
      if (result.overlaps) {
        this.active = false;
        return true;
      }
    }
    return false;
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
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class BulletPool {
  constructor(initialSize = 256) {
    this.pool = [];
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
    return bullet;
  }

  /** Update all active bullets. Check wall collision and enforce soft cap. */
  update(dt, walls) {
    const active = [];

    for (let i = 0; i < this.pool.length; i++) {
      const b = this.pool[i];
      if (!b.active) continue;

      b.update(dt);
      if (!b.active) continue;

      b.checkWalls(walls);
      if (!b.active) continue;

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
