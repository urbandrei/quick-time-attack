import { Enemy } from './enemy.js';
import { resolveWallCollision } from '../collision.js';
import { PLAYER_SPEED } from '../player.js';

// ── Tuning constants ───────────────────────────────────────────────────
const FLEE_SPEED = PLAYER_SPEED * 0.6; // 60% of player speed

export class Heart extends Enemy {
  constructor({ x = 0, y = 0, difficulty = 1.0 } = {}) {
    super({ x, y, enemyType: 'heart', difficulty });
    this.waypoints = [];
    this.waypointIndex = 0;
    this.setState('fleeing');
  }

  setPath(waypoints) {
    this.waypoints = waypoints;
    this.waypointIndex = 0;
    if (waypoints.length > 0) {
      this.setState('pathfinding');
    }
  }

  // ── QTE gate ──────────────────────────────────────────────────────────

  get canTriggerQTE() {
    return this.active && this.state !== 'stunned' && !this.falling && !this.justLanded;
  }

  resetToIdle() {
    if (this.waypoints.length > 0 && this.waypointIndex < this.waypoints.length) {
      this.setState('pathfinding');
    } else {
      this.setState('fleeing');
    }
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

    if (this.state === 'pathfinding') {
      const wp = this.waypoints[this.waypointIndex];
      const dx = wp.x - this.x;
      const dy = wp.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 8) {
        this.waypointIndex++;
        if (this.waypointIndex >= this.waypoints.length) {
          this.setState('fleeing');
        }
      } else {
        this.x += (dx / dist) * FLEE_SPEED * dt;
        this.y += (dy / dist) * FLEE_SPEED * dt;
      }
    } else if (this.state === 'fleeing' && player) {
      const dx = this.x - player.x;
      const dy = this.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        this.x += (dx / dist) * FLEE_SPEED * dt;
        this.y += (dy / dist) * FLEE_SPEED * dt;
      }
    }

    if (walls) {
      resolveWallCollision(this, walls);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    if (this.falling) { this._renderFalling(ctx); return; }
    // Gentle pulse to look alive and inviting
    const pulse = 1 + 0.08 * Math.sin(this.stateTimer * 4);
    const w = this.width * pulse;
    const h = this.height * pulse;

    ctx.fillStyle = this._getColor();
    ctx.fillRect(this.x - w / 2, this.y - h / 2, w, h);
  }
}
