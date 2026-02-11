import { Entity } from './entity.js';
import { input } from './input.js';
import { resolveWallCollision } from './collision.js';

export const PLAYER_SPEED = 250;
export const PLAYER_WALL_RADIUS = 12;
export const PLAYER_BULLET_RADIUS = 4;
export const PLAYER_STARTING_LIVES = 3;
export const INVULN_DURATION = 1; // seconds
const BLINK_INTERVAL = 0.08; // seconds between visibility toggles

export class Player extends Entity {
  constructor({ x = 0, y = 0 } = {}) {
    super({ x, y, width: 32, height: 32, color: '#00ffff' });
    this.wallRadius = PLAYER_WALL_RADIUS;
    this.bulletRadius = PLAYER_BULLET_RADIUS;
    this.speed = PLAYER_SPEED;
    this.lives = PLAYER_STARTING_LIVES;
    this.invulnerable = false;
    this.invulnTimer = 0;
    this.dead = false;
  }

  damage() {
    if (this.invulnerable || this.dead) return false;

    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      this.dead = true;
    } else {
      this.invulnerable = true;
      this.invulnTimer = INVULN_DURATION;
    }
    return true;
  }

  /**
   * Reverse the last damage() call. Used by QTE priority:
   * if a bullet hit and QTE contact happen within 3 frames,
   * the bullet damage is retroactively nullified.
   */
  undoDamage() {
    this.lives++;
    this.invulnerable = false;
    this.invulnTimer = 0;
    this.dead = false;
  }

  update(dt, walls) {
    if (this.dead) return;

    // Tick invulnerability
    if (this.invulnerable) {
      this.invulnTimer -= dt;
      if (this.invulnTimer <= 0) {
        this.invulnerable = false;
        this.invulnTimer = 0;
      }
    }

    let dx = 0;
    let dy = 0;
    if (input.isActionDown('moveLeft'))  dx -= 1;
    if (input.isActionDown('moveRight')) dx += 1;
    if (input.isActionDown('moveUp'))    dy -= 1;
    if (input.isActionDown('moveDown'))  dy += 1;

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }

    // Per-axis movement + collision for smooth slide-along behavior
    this.x += dx * this.speed * dt;
    resolveWallCollision(this, walls, { useCircle: true, radius: this.wallRadius });
    this.y += dy * this.speed * dt;
    resolveWallCollision(this, walls, { useCircle: true, radius: this.wallRadius });
  }

  render(ctx) {
    // Blink during invulnerability — skip rendering on alternate intervals
    if (this.invulnerable) {
      const blinkPhase = Math.floor(this.invulnTimer / BLINK_INTERVAL);
      if (blinkPhase % 2 === 0) return;
    }
    super.render(ctx);
  }
}
