import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { achievements } from '../systems/achievements.js';

const TITLE_Y = 45;
const LIST_START_Y = 105;
const LIST_SPACING = 62;
const BACK_Y = 545;

const ROW_X = 100;
const ROW_W = 600;
const ROW_H = 50;
const ICON_X = 120;
const ICON_SIZE = 12;
const TEXT_X = 148;

const UNLOCKED_ICON_COLOR = '#44ff88';
const UNLOCKED_NAME_COLOR = '#ffffff';
const UNLOCKED_DESC_COLOR = '#888888';
const LOCKED_ICON_COLOR = '#444444';
const LOCKED_NAME_COLOR = '#555555';
const LOCKED_DESC_COLOR = '#444444';

export class AchievementsScene {
  constructor(game) {
    this.game = game;
    this.backHitbox = null;
    this.backHovered = false;
  }

  enter() {}
  exit() {}

  update(dt) {
    if (input.isKeyJustPressed('Escape')) {
      this.game.popScene();
      return;
    }

    // Mouse hover on BACK button
    const mouse = input.getMousePos();
    if (this.backHitbox) {
      const hb = this.backHitbox;
      this.backHovered =
        mouse.x >= hb.x && mouse.x <= hb.x + hb.w &&
        mouse.y >= hb.y && mouse.y <= hb.y + hb.h;
    }

    // Mouse click on BACK button
    if (input.isMouseJustPressed(0) && this.backHovered) {
      this.game.popScene();
    }
  }

  render(ctx) {
    // Dark overlay
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TROPHIES', cx, TITLE_Y);

    // Achievement list
    const all = achievements.getAll();
    for (let i = 0; i < all.length; i++) {
      this._renderRow(ctx, all[i], i);
    }

    // BACK button
    this._renderBackButton(ctx, cx);
  }

  _renderRow(ctx, achievement, index) {
    const y = LIST_START_Y + index * LIST_SPACING;
    const unlocked = achievement.unlocked;

    // Row background
    ctx.fillStyle = unlocked ? 'rgba(68, 255, 136, 0.06)' : 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(ROW_X, y, ROW_W, ROW_H);

    // Status indicator
    ctx.fillStyle = unlocked ? UNLOCKED_ICON_COLOR : LOCKED_ICON_COLOR;
    const iconY = y + ROW_H / 2 - ICON_SIZE / 2;
    ctx.fillRect(ICON_X, iconY, ICON_SIZE, ICON_SIZE);

    // Achievement name
    ctx.fillStyle = unlocked ? UNLOCKED_NAME_COLOR : LOCKED_NAME_COLOR;
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(achievement.name, TEXT_X, y + 10);

    // Description
    ctx.fillStyle = unlocked ? UNLOCKED_DESC_COLOR : LOCKED_DESC_COLOR;
    ctx.font = '7px "Press Start 2P"';
    ctx.fillText(achievement.description, TEXT_X, y + 30);
  }

  _renderBackButton(ctx, cx) {
    const text = this.backHovered ? '> BACK <' : 'BACK';
    ctx.fillStyle = this.backHovered ? '#00ffff' : '#ffffff';
    ctx.font = '14px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, BACK_Y);

    // Cache hitbox
    const metrics = ctx.measureText(text);
    const w = metrics.width + 40;
    this.backHitbox = {
      x: cx - w / 2,
      y: BACK_Y - 20,
      w,
      h: 40,
    };
  }

  onInput(event) {}
}
