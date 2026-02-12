import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';

const HALF_W = CANVAS_WIDTH / 2;
const HALF_H = CANVAS_HEIGHT / 2;

// Intensity targets for different states
const INTENSITY_NORMAL   = 0.2;
const INTENSITY_LOW_HP   = 0.5;
const INTENSITY_QTE      = 0.6;

// How fast intensity lerps toward target (per second)
const LERP_SPEED = 4;

// Gradient geometry
const INNER_RADIUS = 150;  // transparent center
const OUTER_RADIUS = 500;  // fully dark edge

export class Vignette {
  constructor() {
    this.intensity = INTENSITY_NORMAL;
    this._targetIntensity = INTENSITY_NORMAL;

    // Pre-build the gradient shape (only the alpha stops change)
    this._gradient = null;
  }

  /**
   * Update the vignette intensity based on game state.
   * @param {number} dt - Delta time in seconds
   * @param {object} state - { lives, isQTEActive }
   */
  update(dt, { lives = 3, isQTEActive = false } = {}) {
    // Determine target intensity
    if (isQTEActive) {
      this._targetIntensity = INTENSITY_QTE;
    } else if (lives <= 1) {
      this._targetIntensity = INTENSITY_LOW_HP;
    } else {
      this._targetIntensity = INTENSITY_NORMAL;
    }

    // Lerp toward target
    this.intensity += (this._targetIntensity - this.intensity) * LERP_SPEED * dt;
  }

  /**
   * Render the vignette overlay. Call after screen flash in screen-space.
   */
  render(ctx) {
    if (this.intensity <= 0) return;

    // Create a fresh radial gradient each frame (intensity changes the alpha stop)
    const gradient = ctx.createRadialGradient(
      HALF_W, HALF_H, INNER_RADIUS,
      HALF_W, HALF_H, OUTER_RADIUS
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${this.intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}
