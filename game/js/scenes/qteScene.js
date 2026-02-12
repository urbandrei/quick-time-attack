import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { PauseScene } from './pauseScene.js';
import { audio } from '../systems/audio.js';
import { QTE } from '../qtes/qte.js';
import { BatQTE } from '../qtes/batQte.js';
import { TapQTE } from '../qtes/tapQte.js';
import { GopherQTE } from '../qtes/gopherQte.js';
import { SpinningTopQTE } from '../qtes/spinningTopQte.js';
import { LetterQTE } from '../qtes/letterQte.js';
import { CowboyQTE } from '../qtes/cowboyQte.js';
import { ControllerQTE } from '../qtes/controllerQte.js';
import { HeartQTE } from '../qtes/heartQte.js';
import { ClockQTE } from '../qtes/clockQte.js';
import { getQTETimeLimit } from '../systems/difficulty.js';

const SPLASH_DURATION = 1.5;

const QTE_INPUT_TYPE = {
  bat: 'MOUSE',
  gopher: 'MOUSE',
  spinningTop: 'MOUSE',
  letter: 'KEYBOARD',
  cowboy: 'MOUSE',
  controller: 'KEYBOARD',
  heart: 'MOUSE',
  clock: 'MOUSE',
  tap: 'KEYBOARD',
  generator: 'KEYBOARD',
};

const QTE_TASK_DESC = {
  bat: 'CLICK THE BAT',
  gopher: 'WHACK A MOLE',
  spinningTop: 'SPIN THE WHEEL',
  letter: 'TYPE THE WORD',
  cowboy: 'WAIT... CLICK!',
  controller: 'REACH THE EXIT',
  heart: 'HIT THE BEAT',
  clock: 'SET THE TIME',
  tap: 'TAP RAPIDLY',
  generator: 'TAP RAPIDLY',
};

class QTEScene {
  /**
   * @param {import('../game.js').Game} game
   * @param {object} [opts]
   * @param {import('../enemies/enemy.js').Enemy} [opts.enemy]  - The enemy that triggered this QTE
   * @param {Function} [opts.onSuccess] - Called when the QTE is completed successfully
   * @param {Function} [opts.onFail]    - Called when the QTE times out / player fails
   */
  constructor(game, { enemy = null, levelDepth = 1, onSuccess = null, onFail = null } = {}) {
    this.game = game;
    this.enemy = enemy;
    this.levelDepth = levelDepth;
    this.onSuccess = onSuccess;
    this.onFail = onFail;
    this.qte = null;
    this.splashTimer = 0;
    this.splashDone = false;
  }

  enter() {
    // Don't re-create when returning from pause
    if (this.qte) return;

    this.qte = this._createQTE();
    // Don't init yet — wait for splash to finish
    audio.playSFX('qteStart');
    audio.enterQTEMode();
  }

  exit() {
    if (this.qte) {
      this.qte.cleanup();
    }
    audio.exitQTEMode();
  }

  update(dt) {
    if (input.isActionJustPressed('pause')) {
      this.game.pushScene(new PauseScene(this.game));
      return;
    }

    if (!this.qte) return;

    // Splash phase — wait before starting the QTE
    if (!this.splashDone) {
      this.splashTimer += dt;
      if (this.splashTimer >= SPLASH_DURATION) {
        this.splashDone = true;
        this.qte.init();
      }
      return;
    }

    this.qte.update(dt);

    // Drive QTE slowdown → speedup progression
    if (this.qte.timeLimit > 0) {
      audio.setQTEProgress(this.qte.elapsed / this.qte.timeLimit);
    }

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

    if (!this.splashDone) {
      // ── Splash phase: enemy name + input type ──
      this._renderSplash(ctx);
      return;
    }

    // Enemy type label (QTE can opt out by setting hideEnemyLabel)
    if (this.enemy && !(this.qte && this.qte.hideEnemyLabel)) {
      ctx.fillStyle = this.enemy.color || '#ffffff';
      ctx.font = '20px "Press Start 2P"';
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

  _renderSplash(ctx) {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const qteType = this.enemy?.qteType || this.enemy?.enemyType;

    // Task description (large)
    const desc = QTE_TASK_DESC[qteType] || 'GET READY';
    ctx.fillStyle = this.enemy?.color || '#ffffff';
    ctx.font = '20px "Press Start 2P"';
    ctx.fillText(desc, cx, cy - 20);

    // Input type indicator
    const inputType = QTE_INPUT_TYPE[qteType] || 'MOUSE';
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px "Press Start 2P"';
    ctx.fillText(`USE ${inputType}`, cx, cy + 30);
  }

  onInput(event) {
    if (this.qte && this.splashDone) {
      this.qte.onInput(event);
    }
  }

  /**
   * Create the appropriate QTE subclass based on enemy type.
   * Subclass mapping will be added as QTE mini-games are implemented (Steps 20+).
   */
  _createQTE() {
    const type = this.enemy?.qteType;
    const timeLimit = getQTETimeLimit(this.levelDepth);

    if (type === 'bat') {
      return new BatQTE({ enemy: this.enemy, timeLimit, levelDepth: this.levelDepth });
    }

    if (type === 'gopher') {
      return new GopherQTE({ enemy: this.enemy, timeLimit, levelDepth: this.levelDepth });
    }

    if (type === 'spinningTop') {
      return new SpinningTopQTE({ enemy: this.enemy, timeLimit });
    }

    if (type === 'letter') {
      return new LetterQTE({ enemy: this.enemy, timeLimit, levelDepth: this.levelDepth });
    }

    if (type === 'cowboy') {
      return new CowboyQTE({ enemy: this.enemy, timeLimit });
    }

    if (type === 'controller') {
      return new ControllerQTE({ enemy: this.enemy, timeLimit });
    }

    if (type === 'heart') {
      return new HeartQTE({ enemy: this.enemy, timeLimit, levelDepth: this.levelDepth });
    }

    if (type === 'clock') {
      return new ClockQTE({ enemy: this.enemy, timeLimit });
    }

    if (type === 'tap') {
      return new TapQTE({ enemy: this.enemy, timeLimit, levelDepth: this.levelDepth });
    }

    // Fallback — base QTE (counts down and fails on timeout)
    return new QTE({
      timeLimit,
      enemy: this.enemy,
    });
  }
}

export { QTEScene };
