import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';

// Timer bar layout
const BAR_WIDTH = 400;
const BAR_HEIGHT = 12;
const BAR_Y = 60;
const BAR_BG = 'rgba(255, 255, 255, 0.2)';
const BAR_FG = '#ffffff';
const BAR_LOW = '#e74c3c'; // red when time < 25%

export class QTE {
  /**
   * @param {object} opts
   * @param {number} [opts.timeLimit=2] - Time limit in seconds (2–3s per design)
   * @param {import('../enemies/enemy.js').Enemy} [opts.enemy] - The enemy that triggered this QTE
   */
  constructor({ timeLimit = 2, enemy = null } = {}) {
    this.timeLimit = timeLimit;
    this.enemy = enemy;
    this.elapsed = 0;
    this.completed = false;
    this.result = null; // 'success' | 'fail' | null
  }

  /** Called once when the QTE starts. Subclasses override for setup. */
  init() {}

  /**
   * Called every frame. Tracks elapsed time and auto-fails on timeout.
   * Subclasses should call super.update(dt) first and bail if this.completed.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (this.completed) return;

    this.elapsed += dt;
    if (this.elapsed >= this.timeLimit) {
      this.fail();
    }
  }

  /**
   * Renders the common timer bar. Subclasses should call super.render(ctx)
   * first, then draw their own mini-game content.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    this._renderTimerBar(ctx);
  }

  /** Called when the QTE is torn down. Subclasses override for cleanup. */
  cleanup() {}

  /**
   * Called when raw DOM input events arrive (keydown, mousedown, etc.).
   * Subclasses override to react to input.
   * @param {Event} event
   */
  onInput(event) {}

  // ── Result signaling ──────────────────────────────────────────────

  /** Mark the QTE as succeeded. Only fires once. */
  succeed() {
    if (this.completed) return;
    this.completed = true;
    this.result = 'success';
  }

  /** Mark the QTE as failed. Only fires once. */
  fail() {
    if (this.completed) return;
    this.completed = true;
    this.result = 'fail';
  }

  // ── Convenience getters ───────────────────────────────────────────

  /** Time remaining in seconds. */
  get timeRemaining() {
    return Math.max(0, this.timeLimit - this.elapsed);
  }

  /** Fraction of time remaining (1 = full, 0 = expired). */
  get timeFraction() {
    return Math.max(0, 1 - this.elapsed / this.timeLimit);
  }

  // ── Private ───────────────────────────────────────────────────────

  _renderTimerBar(ctx) {
    const barX = (CANVAS_WIDTH - BAR_WIDTH) / 2;
    const fraction = this.timeFraction;

    // Background
    ctx.fillStyle = BAR_BG;
    ctx.fillRect(barX, BAR_Y, BAR_WIDTH, BAR_HEIGHT);

    // Fill (turns red when low)
    ctx.fillStyle = fraction < 0.25 ? BAR_LOW : BAR_FG;
    ctx.fillRect(barX, BAR_Y, BAR_WIDTH * fraction, BAR_HEIGHT);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, BAR_Y, BAR_WIDTH, BAR_HEIGHT);
  }
}
