import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_STORAGE_KEY,
  MENU_ITEMS,
  TITLE_Y,
  STATS_START_Y,
  STATS_SPACING,
  NICKNAME_Y,
  MENU_START_Y,
  MENU_SPACING,
  MENU_HITBOX_HEIGHT,
  MENU_HITBOX_PADDING,
  TITLE_COLOR,
  STAT_LABEL_COLOR,
  STAT_VALUE_COLOR,
  NICKNAME_ACTIVE_COLOR,
  NICKNAME_INACTIVE_COLOR,
  INPUT_BG_COLOR,
  INPUT_CURSOR_COLOR,
  SELECTED_ITEM_COLOR,
  NORMAL_ITEM_COLOR,
  DISABLED_ITEM_COLOR,
} from '../menus/gameOver.js';

import { achievements } from '../systems/achievements.js';
import { leaderboard } from '../systems/leaderboard.js';
import { audio } from '../systems/audio.js';

const RUNS_STORAGE_KEY = 'qta_runs';

export class GameOverScene {
  constructor(game, { levelDepth = 1, enemiesKilled = 0, runLength = 0 } = {}) {
    this.game = game;
    this.levelDepth = levelDepth;
    this.enemiesKilled = enemiesKilled;
    this.runLength = runLength;

    this.selectedIndex = 0;
    this.itemHitboxes = [];

    // Nickname input
    const saved = localStorage.getItem(NICKNAME_STORAGE_KEY);
    this.nickname = saved || '';
    this.typingNickname = false;
    this.submitted = false;

    // Nickname input hitbox (set during render)
    this.nicknameHitbox = null;
  }

  enter() {
    this.selectedIndex = 0;
  }

  exit() {}

  update(dt) {
    // When typing nickname, skip menu navigation
    if (this.typingNickname) {
      // Escape or Enter exits typing mode
      if (input.isKeyJustPressed('Escape') || input.isKeyJustPressed('Enter')) {
        this.typingNickname = false;
      }
      return;
    }

    // Keyboard navigation
    if (input.isActionJustPressed('moveUp')) {
      this._moveToPreviousEnabled();
      audio.playSFX('menuHover');
    } else if (input.isActionJustPressed('moveDown')) {
      this._moveToNextEnabled();
      audio.playSFX('menuHover');
    }

    // Keyboard select
    if (input.isKeyJustPressed('Enter') || input.isActionJustPressed('interact')) {
      audio.playSFX('menuSelect');
      this._executeSelected();
    }

    // Mouse hover over menu items
    const mouse = input.getMousePos();
    for (let i = 0; i < this.itemHitboxes.length; i++) {
      const hb = this.itemHitboxes[i];
      if (!this._isItemEnabled(i)) continue;
      if (
        mouse.x >= hb.x && mouse.x <= hb.x + hb.w &&
        mouse.y >= hb.y && mouse.y <= hb.y + hb.h
      ) {
        this.selectedIndex = i;
        break;
      }
    }

    // Mouse click on menu items
    if (input.isMouseJustPressed(0)) {
      for (let i = 0; i < this.itemHitboxes.length; i++) {
        const hb = this.itemHitboxes[i];
        if (!this._isItemEnabled(i)) continue;
        if (
          mouse.x >= hb.x && mouse.x <= hb.x + hb.w &&
          mouse.y >= hb.y && mouse.y <= hb.y + hb.h
        ) {
          audio.playSFX('menuSelect');
          this._executeItem(i);
          break;
        }
      }

      // Click on nickname input to start typing
      if (this.nicknameHitbox && !this.submitted) {
        const nh = this.nicknameHitbox;
        if (
          mouse.x >= nh.x && mouse.x <= nh.x + nh.w &&
          mouse.y >= nh.y && mouse.y <= nh.y + nh.h
        ) {
          this.typingNickname = true;
        }
      }
    }
  }

  render(ctx) {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;

    // Title
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = '28px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', cx, TITLE_Y);

    // Stats
    this._renderStats(ctx, cx);

    // Nickname input
    this._renderNicknameInput(ctx, cx);

    // Menu items
    this._renderMenuItems(ctx, cx);
  }

  _renderStats(ctx, cx) {
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const stats = [
      { label: 'FLOOR REACHED', value: String(this.levelDepth) },
      { label: 'ENEMIES KILLED', value: String(this.enemiesKilled) },
      { label: 'RUN LENGTH', value: this._formatTime(this.runLength) },
    ];

    for (let i = 0; i < stats.length; i++) {
      const y = STATS_START_Y + i * STATS_SPACING;
      ctx.fillStyle = STAT_LABEL_COLOR;
      ctx.fillText(stats[i].label, cx, y);
      ctx.fillStyle = STAT_VALUE_COLOR;
      ctx.fillText(stats[i].value, cx, y + 14);
    }
  }

  _renderNicknameInput(ctx, cx) {
    const y = NICKNAME_Y;

    // Label
    ctx.fillStyle = this.typingNickname ? NICKNAME_ACTIVE_COLOR : NICKNAME_INACTIVE_COLOR;
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.submitted ? 'NICKNAME (SAVED)' : 'ENTER NICKNAME', cx, y);

    // Input box
    const boxW = 220;
    const boxH = 30;
    const boxX = cx - boxW / 2;
    const boxY = y + 12;

    ctx.fillStyle = INPUT_BG_COLOR;
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Border
    ctx.strokeStyle = this.typingNickname ? NICKNAME_ACTIVE_COLOR : NICKNAME_INACTIVE_COLOR;
    ctx.lineWidth = this.typingNickname ? 2 : 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Nickname text
    ctx.fillStyle = STAT_VALUE_COLOR;
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textX = boxX + 10;
    const textY = boxY + boxH / 2;
    ctx.fillText(this.nickname, textX, textY);

    // Blinking cursor when typing
    if (this.typingNickname && this.nickname.length < NICKNAME_MAX_LENGTH) {
      const cursorPulse = Math.sin(performance.now() / 200) > 0 ? 1 : 0;
      if (cursorPulse) {
        const textWidth = ctx.measureText(this.nickname).width;
        ctx.fillStyle = INPUT_CURSOR_COLOR;
        ctx.fillRect(textX + textWidth + 2, boxY + 6, 2, boxH - 12);
      }
    }

    // Hint
    if (!this.submitted) {
      ctx.fillStyle = '#555555';
      ctx.font = '6px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText(
        this.typingNickname ? 'ENTER to confirm, ESC to cancel' : 'Click to type',
        cx,
        boxY + boxH + 12,
      );
    }

    // Store hitbox for click detection
    this.nicknameHitbox = { x: boxX, y: boxY, w: boxW, h: boxH };
  }

  _renderMenuItems(ctx, cx) {
    this.itemHitboxes = [];

    ctx.font = '14px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const item = MENU_ITEMS[i];
      const y = MENU_START_Y + i * MENU_SPACING;
      const enabled = this._isItemEnabled(i);

      let text;
      if (!enabled) {
        ctx.fillStyle = DISABLED_ITEM_COLOR;
        text = item.label;
      } else if (i === this.selectedIndex) {
        ctx.fillStyle = SELECTED_ITEM_COLOR;
        text = `> ${item.label} <`;
      } else {
        ctx.fillStyle = NORMAL_ITEM_COLOR;
        text = item.label;
      }

      ctx.fillText(text, cx, y);

      // Cache hitbox
      const metrics = ctx.measureText(text);
      const w = metrics.width + MENU_HITBOX_PADDING * 2;
      this.itemHitboxes.push({
        x: cx - w / 2,
        y: y - MENU_HITBOX_HEIGHT / 2,
        w,
        h: MENU_HITBOX_HEIGHT,
      });
    }
  }

  onInput(event) {
    if (!this.typingNickname) return;
    if (event.type !== 'keydown') return;
    if (event.repeat) return;

    const key = event.key;

    // Backspace
    if (key === 'Backspace') {
      this.nickname = this.nickname.slice(0, -1);
      return;
    }

    // Ignore non-printable keys
    if (key.length !== 1) return;

    // Only allow alphanumeric and common symbols
    if (!/[a-zA-Z0-9 _\-.]/.test(key)) return;

    // Max length
    if (this.nickname.length >= NICKNAME_MAX_LENGTH) return;

    this.nickname += key.toUpperCase();
  }

  // --- Navigation helpers ---

  _isItemEnabled(index) {
    const item = MENU_ITEMS[index];
    if (!item.enabled) return false;
    // Disable "Submit Run" if already submitted or no nickname
    if (item.id === 'submit' && (this.submitted || this.nickname.length < NICKNAME_MIN_LENGTH)) {
      return false;
    }
    return true;
  }

  _moveToNextEnabled() {
    const len = MENU_ITEMS.length;
    for (let offset = 1; offset < len; offset++) {
      const idx = (this.selectedIndex + offset) % len;
      if (this._isItemEnabled(idx)) {
        this.selectedIndex = idx;
        return;
      }
    }
  }

  _moveToPreviousEnabled() {
    const len = MENU_ITEMS.length;
    for (let offset = 1; offset < len; offset++) {
      const idx = (this.selectedIndex - offset + len) % len;
      if (this._isItemEnabled(idx)) {
        this.selectedIndex = idx;
        return;
      }
    }
  }

  _executeSelected() {
    if (this._isItemEnabled(this.selectedIndex)) {
      this._executeItem(this.selectedIndex);
    }
  }

  _executeItem(index) {
    const item = MENU_ITEMS[index];

    switch (item.id) {
      case 'submit':
        this._submitRun();
        break;
      case 'playAgain':
        this.game.popScene(); // remove GameOverScene
        this.game.popScene(); // remove dead GameplayScene
        import('./gameplayScene.js').then(({ GameplayScene }) => {
          this.game.pushScene(new GameplayScene(this.game, { startWithLanding: true }));
        });
        break;
      case 'mainMenu':
        this.game.scenes[0]._returnFromGameplay = true;
        this.game.popScene(); // remove GameOverScene
        this.game.popScene(); // remove dead GameplayScene
        break;
    }
  }

  _submitRun() {
    if (this.submitted) return;
    if (this.nickname.length < NICKNAME_MIN_LENGTH) return;

    // Save nickname for next time
    localStorage.setItem(NICKNAME_STORAGE_KEY, this.nickname);

    // Save run to localStorage
    const runs = JSON.parse(localStorage.getItem(RUNS_STORAGE_KEY) || '[]');
    const newRun = {
      nickname: this.nickname,
      levelDepth: this.levelDepth,
      enemiesKilled: this.enemiesKilled,
      runLength: this.runLength,
      timestamp: Date.now(),
    };
    runs.push(newRun);
    localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs));

    achievements.onRunSubmitted(runs, newRun);

    leaderboard.submitEntry(this.nickname, this.levelDepth, this.enemiesKilled, this.runLength);

    this.submitted = true;

    // Move selection to next enabled item
    this._moveToNextEnabled();
  }

  _formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
