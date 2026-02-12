import { QTE } from './qte.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';

// ── Tuning constants ────────────────────────────────────────────────────
const TIME_LIMIT     = 3.0;  // seconds overall
const DRAW_DELAY_MIN = 1.0;  // min wait before "DRAW!" appears
const DRAW_DELAY_MAX = 2.5;
const REACT_WINDOW   = 0.6;  // must click within 0.6s of "DRAW!"

export class CowboyQTE extends QTE {
  constructor({ enemy = null } = {}) {
    super({ timeLimit: TIME_LIMIT, enemy });

    this.hideEnemyLabel = true;
    this.phase = 'waiting'; // 'waiting' | 'draw' | 'resolved'
    this.drawDelay = DRAW_DELAY_MIN + Math.random() * (DRAW_DELAY_MAX - DRAW_DELAY_MIN);
    this.drawTimer = 0;      // time since "DRAW!" appeared
    this.resultText = null;   // brief text after success/fail
    this.resultTimer = 0;
  }

  update(dt) {
    super.update(dt);
    if (this.completed) return;

    if (this.phase === 'waiting') {
      // Waiting for the draw signal
      if (this.elapsed >= this.drawDelay) {
        this.phase = 'draw';
        this.drawTimer = 0;
      }
    } else if (this.phase === 'draw') {
      this.drawTimer += dt;
      if (this.drawTimer >= REACT_WINDOW) {
        // Too slow
        this.fail();
      }
    }
  }

  onInput(event) {
    if (this.completed) return;
    if (event.type !== 'mousedown') return;

    if (this.phase === 'waiting') {
      // Clicked too early — instant fail
      this.fail();
    } else if (this.phase === 'draw') {
      // Good draw!
      this.succeed();
    }
  }

  render(ctx) {
    super.render(ctx); // timer bar

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Cowboy silhouette (colored square)
    const color = (this.enemy && this.enemy.color) || '#d4a574';
    const size = 48;
    ctx.fillStyle = color;
    ctx.fillRect(cx - size / 2, cy - size / 2 + 40, size, size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - size / 2, cy - size / 2 + 40, size, size);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.phase === 'waiting') {
      // Tense waiting phase
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px "Press Start 2P"';
      ctx.fillText('WAIT...', cx, cy - 60);

      // Dots pulse
      const dots = '.'.repeat(1 + Math.floor(this.elapsed * 2) % 3);
      ctx.font = '20px "Press Start 2P"';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(dots, cx, cy - 20);
    } else if (this.phase === 'draw') {
      // DRAW! flash
      const flash = 0.7 + 0.3 * Math.sin(this.drawTimer * 20);
      ctx.font = '36px "Press Start 2P"';
      ctx.fillStyle = `rgba(255, 50, 50, ${flash})`;
      ctx.fillText('DRAW!', cx, cy - 40);

      // Click instruction
      ctx.font = '10px "Press Start 2P"';
      ctx.fillStyle = '#ffff88';
      ctx.fillText('CLICK NOW!', cx, cy);
    }
  }
}
