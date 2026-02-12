import { CANVAS_WIDTH, CANVAS_HEIGHT } from './game.js';

const LIFE_SIZE = 16;
const LIFE_GAP = 6;
const LIFE_Y = 12;
const LIFE_X = 16;
const LIFE_FILLED = '#ff2266';
const LIFE_EMPTY = '#442233';

const BOSS_SEG_SIZE = 20;
const BOSS_SEG_GAP = 8;
const BOSS_SEG_Y = CANVAS_HEIGHT - 44;
const BOSS_FILLED = '#ff2266';
const BOSS_EMPTY = '#442233';

export class HUD {
  constructor() {
    this.lives = 3;
    this.maxLives = 3;
    this.timer = 30;
    this.levelDepth = 1;
    this.challengeType = '';
    this.timerActive = true;
    this.bossHP = 0;
    this.bossMaxHP = 0;
    this.generatorsDone = 0;
    this.generatorsTotal = 0;
  }

  update(dt, { lives, maxLives, timer, levelDepth, challengeType, timerActive, bossHP, bossMaxHP, generatorsDone, generatorsTotal } = {}) {
    if (lives != null) this.lives = lives;
    if (maxLives != null) this.maxLives = maxLives;
    if (timer != null) this.timer = timer;
    if (levelDepth != null) this.levelDepth = levelDepth;
    if (challengeType != null) this.challengeType = challengeType;
    if (timerActive != null) this.timerActive = timerActive;
    if (bossHP != null) this.bossHP = bossHP;
    if (bossMaxHP != null) this.bossMaxHP = bossMaxHP;
    if (generatorsDone != null) this.generatorsDone = generatorsDone;
    if (generatorsTotal != null) this.generatorsTotal = generatorsTotal;
  }

  render(ctx) {
    this._renderLives(ctx);
    this._renderTimer(ctx);
    this._renderChallengeType(ctx);
    this._renderLevelDepth(ctx);
    this._renderBossHP(ctx);
    this._renderGenerators(ctx);
  }

  _renderLives(ctx) {
    for (let i = 0; i < this.maxLives; i++) {
      const x = LIFE_X + i * (LIFE_SIZE + LIFE_GAP);
      if (i < this.lives) {
        ctx.fillStyle = LIFE_FILLED;
        ctx.fillRect(x, LIFE_Y, LIFE_SIZE, LIFE_SIZE);
      } else {
        ctx.strokeStyle = LIFE_EMPTY;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, LIFE_Y, LIFE_SIZE, LIFE_SIZE);
      }
    }
  }

  _renderTimer(ctx) {
    if (!this.timerActive) return;
    const display = Math.max(0, this.timer).toFixed(1);
    ctx.fillStyle = this.timer <= 10 ? '#ff4444' : '#ffffff';
    ctx.font = '28px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(display, CANVAS_WIDTH / 2, 10);
  }

  _renderChallengeType(ctx) {
    if (!this.challengeType) return;
    ctx.fillStyle = '#88aacc';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.challengeType, CANVAS_WIDTH / 2, 44);
  }

  _renderLevelDepth(ctx) {
    const rightX = CANVAS_WIDTH - 16;

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('FLOOR', rightX, 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px "Press Start 2P"';
    ctx.fillText(`${this.levelDepth}`, rightX, 28);
  }

  _renderBossHP(ctx) {
    if (this.bossMaxHP <= 0) return;

    const totalWidth = this.bossMaxHP * (BOSS_SEG_SIZE + BOSS_SEG_GAP) - BOSS_SEG_GAP;
    const startX = (CANVAS_WIDTH - totalWidth) / 2;

    for (let i = 0; i < this.bossMaxHP; i++) {
      const x = startX + i * (BOSS_SEG_SIZE + BOSS_SEG_GAP);
      if (i < this.bossHP) {
        ctx.fillStyle = BOSS_FILLED;
        ctx.fillRect(x, BOSS_SEG_Y, BOSS_SEG_SIZE, BOSS_SEG_SIZE);
      } else {
        ctx.strokeStyle = BOSS_EMPTY;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, BOSS_SEG_Y, BOSS_SEG_SIZE, BOSS_SEG_SIZE);
      }
    }

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('BOSS', CANVAS_WIDTH / 2, BOSS_SEG_Y + BOSS_SEG_SIZE + 6);
  }

  _renderGenerators(ctx) {
    if (this.generatorsTotal <= 0) return;

    const segSize = BOSS_SEG_SIZE;
    const segGap = BOSS_SEG_GAP;
    const totalWidth = this.generatorsTotal * (segSize + segGap) - segGap;
    const startX = (CANVAS_WIDTH - totalWidth) / 2;
    const y = BOSS_SEG_Y;

    for (let i = 0; i < this.generatorsTotal; i++) {
      const x = startX + i * (segSize + segGap);
      if (i < this.generatorsDone) {
        ctx.fillStyle = '#44ff88';
        ctx.fillRect(x, y, segSize, segSize);
      } else {
        ctx.strokeStyle = '#442233';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, segSize, segSize);
      }
    }

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('GENERATORS', CANVAS_WIDTH / 2, y + segSize + 6);
  }
}
