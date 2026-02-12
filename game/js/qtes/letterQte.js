import { QTE } from './qte.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';

// ── Tuning constants ────────────────────────────────────────────────────
const TIME_LIMIT = 2.5; // seconds
const WORD_LIST  = [
  'QUICK', 'BLAST', 'STRIKE', 'FLAME', 'DODGE',
  'SPARK', 'CRASH', 'GHOST', 'LASER', 'PIXEL',
];
const WRONG_FLASH_DURATION = 0.2; // seconds

export class LetterQTE extends QTE {
  constructor({ enemy = null } = {}) {
    super({ timeLimit: TIME_LIMIT, enemy });

    this.hideEnemyLabel = true;
    this.word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    this.typedIndex = 0;
    this.wrongFlash = 0;
  }

  update(dt) {
    super.update(dt);
    if (this.completed) return;

    if (this.wrongFlash > 0) {
      this.wrongFlash -= dt;
    }
  }

  onInput(event) {
    if (this.completed) return;
    if (event.type !== 'keydown') return;
    if (event.repeat) return;

    const expected = this.word[this.typedIndex];
    if (event.key.toUpperCase() === expected) {
      this.typedIndex++;
      if (this.typedIndex >= this.word.length) {
        this.succeed();
      }
    } else {
      // Wrong key — reset progress
      this.typedIndex = 0;
      this.wrongFlash = WRONG_FLASH_DURATION;
    }
  }

  render(ctx) {
    super.render(ctx); // timer bar

    // Instruction text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Type the Word!', CANVAS_WIDTH / 2, 68);

    // Word display — large font, centered
    const fontSize = 32;
    ctx.font = `${fontSize}px "Press Start 2P"`;
    const wordY = CANVAS_HEIGHT / 2;

    // Measure total word width to center it
    const charWidths = [];
    let totalWidth = 0;
    for (let i = 0; i < this.word.length; i++) {
      const w = ctx.measureText(this.word[i]).width;
      charWidths.push(w);
      totalWidth += w;
    }

    let drawX = CANVAS_WIDTH / 2 - totalWidth / 2;

    // Draw each character
    for (let i = 0; i < this.word.length; i++) {
      if (this.wrongFlash > 0) {
        // Red flash on wrong key
        ctx.fillStyle = '#e74c3c';
      } else if (i < this.typedIndex) {
        // Correctly typed — green
        ctx.fillStyle = '#2ecc71';
      } else {
        // Remaining — white
        ctx.fillStyle = '#ffffff';
      }

      ctx.textAlign = 'left';
      ctx.fillText(this.word[i], drawX, wordY);

      // Cursor underline under next expected character
      if (i === this.typedIndex && this.wrongFlash <= 0) {
        const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 8);
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.fillRect(drawX, wordY + fontSize / 2 + 4, charWidths[i], 3);
      }

      drawX += charWidths[i];
    }
  }
}
