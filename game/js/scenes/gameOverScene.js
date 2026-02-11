import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';

export class GameOverScene {
  constructor(game) {
    this.game = game;
  }

  enter() {}
  exit() {}

  update(dt) {
    if (input.isActionJustPressed('interact')) {
      // Pop GameOver, pop old Gameplay, push fresh Gameplay
      this.game.popScene(); // remove GameOverScene
      this.game.popScene(); // remove dead GameplayScene
      // Dynamically import to avoid circular dependency
      import('./gameplayScene.js').then(({ GameplayScene }) => {
        this.game.pushScene(new GameplayScene(this.game));
      });
    }
  }

  render(ctx) {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

    // Prompt
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px monospace';
    ctx.fillText('Press E to restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
  }

  onInput(event) {}
}
