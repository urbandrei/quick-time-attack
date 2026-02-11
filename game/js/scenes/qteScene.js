import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { PauseScene } from './pauseScene.js';
import { QTE } from '../qtes/qte.js';
import { BatQTE } from '../qtes/batQte.js';

class QTEScene {
  /**
   * @param {import('../game.js').Game} game
   * @param {object} [opts]
   * @param {import('../enemies/enemy.js').Enemy} [opts.enemy]  - The enemy that triggered this QTE
   * @param {Function} [opts.onSuccess] - Called when the QTE is completed successfully
   * @param {Function} [opts.onFail]    - Called when the QTE times out / player fails
   */
  constructor(game, { enemy = null, onSuccess = null, onFail = null } = {}) {
    this.game = game;
    this.enemy = enemy;
    this.onSuccess = onSuccess;
    this.onFail = onFail;
    this.qte = null;
  }

  enter() {
    // Don't re-create when returning from pause
    if (this.qte) return;

    this.qte = this._createQTE();
    this.qte.init();
  }

  exit() {
    if (this.qte) {
      this.qte.cleanup();
    }
  }

  update(dt) {
    if (input.isActionJustPressed('pause')) {
      this.game.pushScene(new PauseScene(this.game));
      return;
    }

    if (!this.qte) return;

    this.qte.update(dt);

    if (this.qte.completed) {
      if (this.qte.result === 'success') {
        if (this.onSuccess) this.onSuccess(this.enemy);
      } else {
        if (this.onFail) this.onFail(this.enemy);
      }
      this.game.popScene();
    }
  }

  render(ctx) {
    // Semi-transparent dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Enemy type label (QTE can opt out by setting hideEnemyLabel)
    if (this.enemy && !(this.qte && this.qte.hideEnemyLabel)) {
      ctx.fillStyle = this.enemy.color || '#ffffff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        this.enemy.enemyType.toUpperCase(),
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 - 120
      );
    }

    // QTE renders timer bar + mini-game content
    if (this.qte) {
      this.qte.render(ctx);
    }
  }

  onInput(event) {
    if (this.qte) {
      this.qte.onInput(event);
    }
  }

  /**
   * Create the appropriate QTE subclass based on enemy type.
   * Subclass mapping will be added as QTE mini-games are implemented (Steps 20+).
   */
  _createQTE() {
    const type = this.enemy?.qteType;

    if (type === 'bat') {
      return new BatQTE({ enemy: this.enemy });
    }

    // Fallback — base QTE (counts down and fails on timeout)
    return new QTE({
      timeLimit: 2,
      enemy: this.enemy,
    });
  }
}

export { QTEScene };
