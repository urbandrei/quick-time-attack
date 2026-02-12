import { QTE } from './qte.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { audio } from '../systems/audio.js';

// ── Tuning constants ────────────────────────────────────────────────────
const TIME_LIMIT     = 3.5;   // seconds
const HEART_COUNT    = 3;
const HEART_SPACING  = 120;   // px between hearts
const SCROLL_SPEED   = 160;   // px/s — hearts scroll left to right
const HIT_TOLERANCE  = 36;    // ±px from target line center
const HEART_SIZE     = 28;    // visual size of each heart marker

// Track layout
const TRACK_Y       = CANVAS_HEIGHT / 2 + 10;
const TARGET_X      = CANVAS_WIDTH - 160;  // hit zone x position
const TRACK_LEFT    = 80;
const TRACK_RIGHT   = CANVAS_WIDTH - 80;

export class HeartQTE extends QTE {
  constructor({ enemy = null } = {}) {
    super({ timeLimit: TIME_LIMIT, enemy });

    this.hideEnemyLabel = true;

    // Build hearts — spaced evenly, starting off-screen left
    this.hearts = [];
    for (let i = 0; i < HEART_COUNT; i++) {
      this.hearts.push({
        // heart[0] is closest to target (arrives first)
        x: TARGET_X - 150 - i * HEART_SPACING,
        hit: false,
        missed: false,
      });
    }

    this.nextHeart = 0; // index of next heart to hit
  }

  update(dt) {
    super.update(dt);
    if (this.completed) return;

    // Scroll all hearts to the right
    for (const h of this.hearts) {
      h.x += SCROLL_SPEED * dt;
    }

    // Check if the next expected heart has passed the hit zone without being clicked
    if (this.nextHeart < HEART_COUNT) {
      const h = this.hearts[this.nextHeart];
      if (h.x > TARGET_X + HIT_TOLERANCE && !h.hit) {
        // Missed — fail
        h.missed = true;
        this.fail();
      }
    }
  }

  onInput(event) {
    if (this.completed) return;
    if (event.type !== 'mousedown') return;
    if (this.nextHeart >= HEART_COUNT) return;

    const h = this.hearts[this.nextHeart];
    const dist = Math.abs(h.x - TARGET_X);

    if (dist <= HIT_TOLERANCE) {
      // Hit!
      audio.playSFX('qteClick');
      h.hit = true;
      this.nextHeart++;

      if (this.nextHeart >= HEART_COUNT) {
        this.succeed();
      }
    } else {
      // Clicked at the wrong time — fail
      this.fail();
    }
  }

  render(ctx) {
    super.render(ctx); // timer bar

    // Instruction text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Click on the Beat!', CANVAS_WIDTH / 2, 68);

    // Track line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TRACK_LEFT, TRACK_Y);
    ctx.lineTo(TRACK_RIGHT, TRACK_Y);
    ctx.stroke();

    // Target zone — vertical band
    const zoneAlpha = 0.15 + 0.1 * Math.sin(this.elapsed * 6);
    ctx.fillStyle = `rgba(255, 105, 180, ${zoneAlpha})`;
    ctx.fillRect(TARGET_X - HIT_TOLERANCE, TRACK_Y - 30, HIT_TOLERANCE * 2, 60);

    // Target line
    ctx.strokeStyle = '#ff69b4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TARGET_X, TRACK_Y - 30);
    ctx.lineTo(TARGET_X, TRACK_Y + 30);
    ctx.stroke();

    // Hearts
    const half = HEART_SIZE / 2;
    for (let i = 0; i < this.hearts.length; i++) {
      const h = this.hearts[i];

      if (h.hit) {
        // Hit — fading green burst
        ctx.fillStyle = '#44ff88';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(h.x - half, TRACK_Y - half, HEART_SIZE, HEART_SIZE);
        ctx.globalAlpha = 1;
      } else if (h.missed) {
        // Missed — red X
        ctx.fillStyle = '#e74c3c';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(h.x - half, TRACK_Y - half, HEART_SIZE, HEART_SIZE);
        ctx.globalAlpha = 1;
      } else {
        // Upcoming — pink square, pulsing if it's the next expected
        const isNext = (i === this.nextHeart);
        const pulse = isNext ? 1 + 0.1 * Math.sin(this.elapsed * 10) : 1;
        const s = HEART_SIZE * pulse;
        const hs = s / 2;

        ctx.fillStyle = '#ff69b4';
        ctx.fillRect(h.x - hs, TRACK_Y - hs, s, s);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(h.x - hs, TRACK_Y - hs, s, s);
      }
    }

    // Hit counter
    const hits = this.hearts.filter(h => h.hit).length;
    ctx.fillStyle = '#ff69b4';
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`${hits} / ${HEART_COUNT}`, CANVAS_WIDTH / 2, TRACK_Y + 50);
  }
}
