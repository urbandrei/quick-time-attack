import { Easing } from './systems/tweens.js';

export class Entity {
  constructor({ x = 0, y = 0, width = 32, height = 32, color = '#ffffff' } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.active = true;

    // Squash & stretch scale
    this.scaleX = 1;
    this.scaleY = 1;
    this._scaleTween = null; // { timer, duration, startX, startY }
  }

  /**
   * Squash: widen + flatten, then elastic-bounce back to 1.0.
   * @param {number} intensity - How much to deform (0–1)
   * @param {number} duration  - Recovery duration in seconds
   */
  squash(intensity = 0.3, duration = 0.15) {
    this.scaleX = 1 + intensity;
    this.scaleY = 1 - intensity;
    this._scaleTween = { timer: 0, duration, startX: this.scaleX, startY: this.scaleY };
  }

  /**
   * Stretch: narrow + elongate, then elastic-bounce back to 1.0.
   * @param {number} intensity - How much to deform (0–1)
   * @param {number} duration  - Recovery duration in seconds
   */
  stretch(intensity = 0.3, duration = 0.15) {
    this.scaleX = 1 - intensity;
    this.scaleY = 1 + intensity;
    this._scaleTween = { timer: 0, duration, startX: this.scaleX, startY: this.scaleY };
  }

  /**
   * Tick the self-contained scale tween, lerping scaleX/scaleY back to 1.0.
   * Call from subclass update() methods.
   */
  _updateScale(dt) {
    if (!this._scaleTween) return;

    this._scaleTween.timer += dt;
    const t = Math.min(this._scaleTween.timer / this._scaleTween.duration, 1);
    const eased = Easing.outElastic(t);

    this.scaleX = this._scaleTween.startX + (1 - this._scaleTween.startX) * eased;
    this.scaleY = this._scaleTween.startY + (1 - this._scaleTween.startY) * eased;

    if (t >= 1) {
      this.scaleX = 1;
      this.scaleY = 1;
      this._scaleTween = null;
    }
  }

  update(dt) {}

  render(ctx) {
    const w = this.width * this.scaleX;
    const h = this.height * this.scaleY;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - w / 2, this.y - h / 2, w, h);
  }
}
