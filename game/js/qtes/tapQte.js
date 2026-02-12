import { QTE } from './qte.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { audio } from '../systems/audio.js';
import { getGeneratorTapTarget } from '../systems/difficulty.js';

const BAR_W = 300;
const BAR_H = 30;
const BAR_Y = CANVAS_HEIGHT / 2 - 20;

export class TapQTE extends QTE {
  constructor({ enemy = null, timeLimit = 5, levelDepth = 1 } = {}) {
    super({ timeLimit, enemy });
    this.taps = 0;
    this.target = getGeneratorTapTarget(levelDepth);
    this.hideEnemyLabel = true;
  }

  onInput(event) {
    if (event.type === 'mousedown' && !this.completed) {
      audio.playSFX('qteClick');
      this.taps++;
      if (this.taps >= this.target) {
        this.succeed();
      }
    }
  }

  render(ctx) {
    super.render(ctx);

    // "CLICK!" label
    ctx.fillStyle = '#ffaa00';
    ctx.font = '24px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLICK!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

    // Progress bar
    const barX = (CANVAS_WIDTH - BAR_W) / 2;
    const progress = Math.min(this.taps / this.target, 1);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(barX, BAR_Y, BAR_W, BAR_H);

    ctx.fillStyle = '#44ff88';
    ctx.fillRect(barX, BAR_Y, BAR_W * progress, BAR_H);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, BAR_Y, BAR_W, BAR_H);

    // Count
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px "Press Start 2P"';
    ctx.fillText(`${this.taps} / ${this.target}`, CANVAS_WIDTH / 2, BAR_Y + BAR_H + 30);
  }
}
