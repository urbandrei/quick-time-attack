import { QTE } from './qte.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';

// ── Tuning constants ────────────────────────────────────────────────────
const TIME_LIMIT       = 3;              // seconds
const TARGET_ROTATION  = Math.PI * 6;    // 3 full circles
const RING_RADIUS      = 100;            // visual indicator ring radius
const RING_THICKNESS   = 12;
const MIN_DISTANCE     = 30;             // ignore mouse if too close to center
const CENTER_X         = CANVAS_WIDTH / 2;
const CENTER_Y         = CANVAS_HEIGHT / 2;

export class SpinningTopQTE extends QTE {
  constructor({ enemy = null } = {}) {
    super({ timeLimit: TIME_LIMIT, enemy });

    this.hideEnemyLabel = true;
    this.prevAngle = null;
    this.totalRotation = 0;
  }

  update(dt) {
    super.update(dt);
    if (this.completed) return;

    const mouse = input.getMousePos();
    const dx = mouse.x - CENTER_X;
    const dy = mouse.y - CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Skip if mouse is too close to center (noisy angles)
    if (dist < MIN_DISTANCE) {
      this.prevAngle = null;
      return;
    }

    const currentAngle = Math.atan2(dy, dx);

    if (this.prevAngle !== null) {
      // Compute angular delta with wraparound handling
      let delta = currentAngle - this.prevAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;

      this.totalRotation += Math.abs(delta);

      if (this.totalRotation >= TARGET_ROTATION) {
        this.succeed();
      }
    }

    this.prevAngle = currentAngle;
  }

  render(ctx) {
    super.render(ctx); // timer bar

    // Instruction text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Spin the Mouse!', CENTER_X, 68);

    // Progress fraction
    const progress = Math.min(this.totalRotation / TARGET_ROTATION, 1);

    // Ring background
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, RING_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = RING_THICKNESS;
    ctx.stroke();

    // Ring fill — white → green as it fills
    if (progress > 0) {
      const r = Math.round(255 * (1 - progress));
      const g = 255;
      const b = Math.round(255 * (1 - progress));
      ctx.beginPath();
      ctx.arc(CENTER_X, CENTER_Y, RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = RING_THICKNESS;
      ctx.stroke();
    }

    // Mouse angle indicator on the ring
    const mouse = input.getMousePos();
    const dx = mouse.x - CENTER_X;
    const dy = mouse.y - CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= MIN_DISTANCE) {
      const angle = Math.atan2(dy, dx);
      const ix = CENTER_X + Math.cos(angle) * RING_RADIUS;
      const iy = CENTER_Y + Math.sin(angle) * RING_RADIUS;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ix, iy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center dot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
