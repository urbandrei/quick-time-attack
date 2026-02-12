import { Entity } from './entity.js';
import { input } from './input.js';
import { resolveWallCollision } from './collision.js';

export const PLAYER_SPEED = 250;
export const PLAYER_WALL_RADIUS = 12;
export const PLAYER_BULLET_RADIUS = 8;
export const PLAYER_STARTING_LIVES = 3;
export const PLAYER_MAX_LIVES = 5;
export const INVULN_DURATION = 1; // seconds
const BLINK_INTERVAL = 0.08; // seconds between visibility toggles

// Dash
const DASH_SPEED = 800;       // px/s (3.2x normal speed)
const DASH_DURATION = 0.12;   // seconds (very short burst)
const DASH_COOLDOWN = 0.5;    // seconds between dashes
const DASH_AFTERIMAGE_INTERVAL = 0.02; // seconds between afterimage spawns
const DASH_AFTERIMAGE_LIFE = 0.2;      // seconds an afterimage lasts

export class Player extends Entity {
  constructor({ x = 0, y = 0 } = {}) {
    super({ x, y, width: 32, height: 32, color: '#00ffff' });
    this.wallRadius = PLAYER_WALL_RADIUS;
    this.bulletRadius = PLAYER_BULLET_RADIUS;
    this.speed = PLAYER_SPEED;
    this.vx = 0;
    this.vy = 0;
    this.lives = PLAYER_STARTING_LIVES;
    this.invulnerable = false;
    this.invulnTimer = 0;
    this.dead = false;

    // Movement tracking for squash/stretch
    this._wasMoving = false;

    // Dash state
    this.dashing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirX = 0;
    this.dashDirY = 0;
    this._lastDirX = 1;
    this._lastDirY = 0;
    this._dashJustStarted = false;
    this._predashInvuln = false;
    this._dashAfterimages = [];       // array of { x, y, timer }
    this._afterimageSpawnTimer = 0;
  }

  damage() {
    if (this.invulnerable || this.dead) return false;

    this.lives--;
    this.flashWhite(3);
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

  /**
   * Grant an extra life, capped at PLAYER_MAX_LIVES.
   * @returns {boolean} true if a life was actually added
   */
  addLife() {
    if (this.lives >= PLAYER_MAX_LIVES) return false;
    this.lives++;
    return true;
  }

  update(dt, walls) {
    if (this.dead) return;

    // Tick invulnerability (only when not dashing — dash manages its own)
    if (this.invulnerable && !this.dashing) {
      this.invulnTimer -= dt;
      if (this.invulnTimer <= 0) {
        this.invulnerable = false;
        this.invulnTimer = 0;
      }
    }

    // Tick dash cooldown
    if (!this.dashing && this.dashCooldown > 0) {
      this.dashCooldown -= dt;
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

    // Track last movement direction for dash
    if (dx !== 0 || dy !== 0) {
      this._lastDirX = dx;
      this._lastDirY = dy;
    }

    // ── Dash initiation ──
    if (input.isActionJustPressed('dash') && this.dashCooldown <= 0 && !this.dashing) {
      let ddx = dx;
      let ddy = dy;
      if (ddx === 0 && ddy === 0) {
        ddx = this._lastDirX;
        ddy = this._lastDirY;
      }
      // Normalize
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      if (len > 0) { ddx /= len; ddy /= len; }

      this.dashing = true;
      this.dashTimer = DASH_DURATION;
      this.dashCooldown = DASH_COOLDOWN;
      this.dashDirX = ddx;
      this.dashDirY = ddy;
      this._predashInvuln = this.invulnerable;
      this.invulnerable = true;
      this.stretch(0.3, 0.15);
      this._dashJustStarted = true;
    }

    // ── Dash movement ──
    if (this.dashing) {
      this.vx = this.dashDirX * DASH_SPEED;
      this.vy = this.dashDirY * DASH_SPEED;

      this.x += this.vx * dt;
      resolveWallCollision(this, walls, { useCircle: true, radius: this.wallRadius });
      this.y += this.vy * dt;
      resolveWallCollision(this, walls, { useCircle: true, radius: this.wallRadius });

      // Spawn afterimage squares along the trail
      this._afterimageSpawnTimer += dt;
      while (this._afterimageSpawnTimer >= DASH_AFTERIMAGE_INTERVAL) {
        this._afterimageSpawnTimer -= DASH_AFTERIMAGE_INTERVAL;
        this._dashAfterimages.push({ x: this.x, y: this.y, timer: 0 });
      }

      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.dashing = false;
        this._afterimageSpawnTimer = 0;
        // Restore pre-dash invulnerability state
        if (!this._predashInvuln) {
          this.invulnerable = false;
          this.invulnTimer = 0;
        }
        this.squash(0.25, 0.12);
      }
    } else {
      // ── Normal movement ──
      // Detect movement start/stop for squash/stretch
      const isMoving = dx !== 0 || dy !== 0;
      if (isMoving && !this._wasMoving) {
        this.stretch(0.15, 0.12);
      } else if (!isMoving && this._wasMoving) {
        this.squash(0.15, 0.1);
      }
      this._wasMoving = isMoving;

      // Expose velocity for predictive aiming (e.g. Cowboy enemy)
      this.vx = dx * this.speed;
      this.vy = dy * this.speed;

      // Per-axis movement + collision for smooth slide-along behavior
      this.x += dx * this.speed * dt;
      resolveWallCollision(this, walls, { useCircle: true, radius: this.wallRadius });
      this.y += dy * this.speed * dt;
      resolveWallCollision(this, walls, { useCircle: true, radius: this.wallRadius });
    }

    // Tick afterimages
    for (let i = this._dashAfterimages.length - 1; i >= 0; i--) {
      this._dashAfterimages[i].timer += dt;
      if (this._dashAfterimages[i].timer >= DASH_AFTERIMAGE_LIFE) {
        this._dashAfterimages.splice(i, 1);
      }
    }

    // Tick scale tween
    this._updateScale(dt);
  }

  render(ctx) {
    // Draw dash afterimages (behind the player)
    if (this._dashAfterimages.length > 0) {
      const w = this.width;
      const h = this.height;
      for (const img of this._dashAfterimages) {
        const t = img.timer / DASH_AFTERIMAGE_LIFE;
        const alpha = 0.5 * (1 - t);
        const scale = 1 - t * 0.3; // shrink slightly as they fade
        const sw = w * scale;
        const sh = h * scale;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(img.x - sw / 2, img.y - sh / 2, sw, sh);
      }
      ctx.globalAlpha = 1;
    }

    // Blink during invulnerability — skip rendering on alternate intervals
    // (but always render while dashing)
    if (this.invulnerable && !this.dashing) {
      const blinkPhase = Math.floor(this.invulnTimer / BLINK_INTERVAL);
      if (blinkPhase % 2 === 0) return;
    }
    super.render(ctx);
  }
}
