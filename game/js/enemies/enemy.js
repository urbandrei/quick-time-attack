import { Entity } from '../entity.js';
import { resolveWallCollision } from '../collision.js';

const KNOCKBACK_FRICTION = 5; // exponential decay rate

// Distinct color per enemy type (colored squares for prototype)
const ENEMY_COLORS = {
  bat:         '#e74c3c',
  gopher:      '#8b6914',
  spinningTop: '#ff8800',
  letter:      '#2ecc71',
  cowboy:      '#d4a574',
  controller:  '#9b59b6',
  heart:       '#ff69b4',
  clock:       '#3498db',
};

export class Enemy extends Entity {
  /**
   * @param {object} opts
   * @param {number}  opts.x
   * @param {number}  opts.y
   * @param {string} [opts.enemyType='bat'] - Enemy type id (bat, gopher, etc.)
   */
  constructor({ x = 0, y = 0, enemyType = 'bat' } = {}) {
    const color = ENEMY_COLORS[enemyType] || '#ff0000';
    super({ x, y, width: 32, height: 32, color });

    this.enemyType = enemyType;
    this.qteType = enemyType; // QTE mini-game type maps 1:1 with enemy type

    // State machine (string-based, subclasses add their own states)
    this.state = 'idle';
    this.stateTimer = 0;

    // Knockback velocity (applied by QTE blast)
    this.knockbackVx = 0;
    this.knockbackVy = 0;
  }

  // ── State machine ──────────────────────────────────────────────────

  /**
   * Transition to a new state. Calls exit/enter hooks and resets the state timer.
   * @param {string} newState
   */
  setState(newState) {
    if (newState === this.state) return;
    const oldState = this.state;
    this.onStateExit(oldState);
    this.state = newState;
    this.stateTimer = 0;
    this.onStateEnter(newState);
  }

  /** Override in subclasses for per-state setup. */
  onStateEnter(state) {}

  /** Override in subclasses for per-state teardown. */
  onStateExit(state) {}

  // ── Combat ─────────────────────────────────────────────────────────

  /**
   * Whether this enemy can currently trigger a QTE on player contact.
   * Subclasses override to add restrictions (e.g., Bat cannot be QTE'd mid-lunge).
   */
  get canTriggerQTE() {
    return this.active && this.state !== 'stunned';
  }

  /**
   * Called when the enemy is killed (e.g., QTE success on this enemy).
   * Deactivates the entity.
   */
  takeDamage() {
    this.active = false;
  }

  /**
   * Interrupt current action and return to idle state.
   * Subclasses override to map to their own idle state.
   */
  resetToIdle() {
    this.setState('idle');
  }

  /**
   * Apply a knockback impulse away from (fromX, fromY).
   * @param {number} fromX - Blast center X
   * @param {number} fromY - Blast center Y
   * @param {number} force - Initial impulse in px/s
   */
  applyKnockback(fromX, fromY, force) {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let dirX, dirY;
    if (dist > 0) {
      dirX = dx / dist;
      dirY = dy / dist;
    } else {
      // Enemy at exact blast center — random direction
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    }

    this.knockbackVx = dirX * force;
    this.knockbackVy = dirY * force;
    this.resetToIdle();
  }

  /**
   * Apply knockback velocity and decay it via exponential friction.
   * Call at the start of update(), before wall collision.
   * @param {number} dt
   */
  _updateKnockback(dt) {
    if (this.knockbackVx === 0 && this.knockbackVy === 0) return;

    this.x += this.knockbackVx * dt;
    this.y += this.knockbackVy * dt;

    const decay = Math.exp(-KNOCKBACK_FRICTION * dt);
    this.knockbackVx *= decay;
    this.knockbackVy *= decay;

    // Snap to zero when velocity is negligible
    if (Math.abs(this.knockbackVx) < 1 && Math.abs(this.knockbackVy) < 1) {
      this.knockbackVx = 0;
      this.knockbackVy = 0;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────

  /**
   * @param {number} dt - Delta time in seconds
   * @param {{x:number,y:number,w:number,h:number}[]} walls - Wall segments for collision
   * @param {import('../player.js').Player} [player] - Player reference for targeting
   */
  update(dt, walls, player) {
    if (!this.active) return;

    this.stateTimer += dt;
    this._updateKnockback(dt);

    // Subclasses implement movement before calling super.update() or after.
    // Wall collision ensures enemy stays inside room boundaries.
    if (walls) {
      resolveWallCollision(this, walls);
    }
  }
}
