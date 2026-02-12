import { QTE } from './qte.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { audio } from '../systems/audio.js';

// ── Tuning constants ────────────────────────────────────────────────────
const TIME_LIMIT    = 3;      // seconds
const BASE_SPEED    = 200;    // px/s initial
const RAMP_RATE     = 100;    // px/s gained per second (≈500 at 3s)
const MARGIN        = 60;     // px padding from canvas edges
const BAT_SIZE      = 32;     // visual size
const CLICK_SIZE    = 48;     // click hitbox (generous)
const JITTER        = Math.PI / 6; // ±30° bounce jitter

export class BatQTE extends QTE {
  constructor({ enemy = null } = {}) {
    super({ timeLimit: TIME_LIMIT, enemy });

    this.hideEnemyLabel = true;

    // Random start position within play area
    this.batX = MARGIN + Math.random() * (CANVAS_WIDTH - 2 * MARGIN);
    this.batY = MARGIN + Math.random() * (CANVAS_HEIGHT - 2 * MARGIN);

    // Random initial direction
    this.angle = Math.random() * Math.PI * 2;
    this.baseSpeed = BASE_SPEED;
    this.rampRate = RAMP_RATE;

    // Wobble animation
    this.wobblePhase = 0;
  }

  update(dt) {
    super.update(dt);
    if (this.completed) return;

    // Current speed ramps up over time
    const speed = this.baseSpeed + this.rampRate * this.elapsed;

    // Move bat
    this.batX += Math.cos(this.angle) * speed * dt;
    this.batY += Math.sin(this.angle) * speed * dt;

    // Bounce off play area edges
    const minX = MARGIN;
    const maxX = CANVAS_WIDTH - MARGIN;
    const minY = MARGIN;
    const maxY = CANVAS_HEIGHT - MARGIN;

    if (this.batX < minX) {
      this.batX = minX;
      this.angle = Math.PI - this.angle + _jitter();
    } else if (this.batX > maxX) {
      this.batX = maxX;
      this.angle = Math.PI - this.angle + _jitter();
    }

    if (this.batY < minY) {
      this.batY = minY;
      this.angle = -this.angle + _jitter();
    } else if (this.batY > maxY) {
      this.batY = maxY;
      this.angle = -this.angle + _jitter();
    }

    // Wobble animation
    this.wobblePhase += dt * 12;

    // Check click
    if (input.isMouseJustPressed(0)) {
      const mouse = input.getMousePos();
      const halfHit = CLICK_SIZE / 2;
      if (
        mouse.x >= this.batX - halfHit && mouse.x <= this.batX + halfHit &&
        mouse.y >= this.batY - halfHit && mouse.y <= this.batY + halfHit
      ) {
        audio.playSFX('qteClick');
        this.succeed();
      }
    }
  }

  render(ctx) {
    super.render(ctx); // timer bar

    // Instruction text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Click the Bat!', CANVAS_WIDTH / 2, 68);

    // Bat visual — slight wobble to feel alive
    const wobbleX = Math.sin(this.wobblePhase) * 2;
    const wobbleY = Math.cos(this.wobblePhase * 1.3) * 2;

    const color = (this.enemy && this.enemy.color) || '#e74c3c';
    const half = BAT_SIZE / 2;
    const drawX = this.batX + wobbleX - half;
    const drawY = this.batY + wobbleY - half;

    ctx.fillStyle = color;
    ctx.fillRect(drawX, drawY, BAT_SIZE, BAT_SIZE);

    // Thin border for visibility against dark overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX, drawY, BAT_SIZE, BAT_SIZE);
  }
}

function _jitter() {
  return (Math.random() - 0.5) * 2 * JITTER;
}
