import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';

export class ScreenFlash {
  constructor() {
    this.color = '#ffffff';
    this.alpha = 0;
    this.duration = 0;
    this.timer = 0;
  }

  /**
   * Trigger a screen flash.
   * @param {string} color - CSS color
   * @param {number} duration - Fade duration in seconds
   */
  flash(color, duration = 0.1) {
    this.color = color;
    this.alpha = 1;
    this.duration = duration;
    this.timer = 0;
  }

  update(dt) {
    if (this.alpha <= 0) return;
    this.timer += dt;
    this.alpha = Math.max(0, 1 - this.timer / this.duration);
  }

  /** Render after all world + HUD drawing (screen-space overlay). */
  render(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha * 0.4; // never fully opaque
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }
}
