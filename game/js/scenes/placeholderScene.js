import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';

export class PlaceholderScene {
  constructor(game, { title = '' } = {}) {
    this.game = game;
    this.title = title;
  }

  enter() {}
  exit() {}

  update(dt) {
    if (input.isActionJustPressed('interact')) {
      this.game.popScene();
    }
  }

  render(ctx) {
    // Semi-transparent dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px "Press Start 2P"';
    ctx.fillText(this.title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

    // Subtitle
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText('Coming Soon', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);

    // Prompt
    ctx.fillStyle = '#44ff88';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText('Press E to go back', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
  }

  onInput(event) {}
}
