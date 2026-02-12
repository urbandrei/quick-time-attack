import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { leaderboard } from '../systems/leaderboard.js';

const TITLE_Y = 45;
const HEADER_Y = 90;
const ENTRIES_START_Y = 115;
const ROW_SPACING = 28;
const BACK_Y = 545;
const MAX_DISPLAY = 10;

// Column x positions
const COL_RANK = 100;
const COL_NICKNAME = 140;
const COL_KILLS = 440;
const COL_FLOOR = 540;
const COL_TIME = 660;

export class LeaderboardScene {
  constructor(game) {
    this.game = game;
    this.backHitbox = null;
    this.backHovered = false;
  }

  enter() {
    leaderboard.fetchRemoteEntries();
  }

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
    // Background fill (goes through CRT)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  renderOverlay(ctx) {
    const cx = CANVAS_WIDTH / 2;

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCORES', cx, TITLE_Y);

    // Header row
    this._renderHeader(ctx);

    // Entries
    const entries = leaderboard.getEntries();

    if (leaderboard.loading && entries.length === 0) {
      ctx.fillStyle = '#666666';
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOADING...', cx, ENTRIES_START_Y + 60);
    } else if (entries.length === 0) {
      ctx.fillStyle = '#666666';
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NO SCORES YET', cx, ENTRIES_START_Y + 60);
    } else {
      const count = Math.min(entries.length, MAX_DISPLAY);
      for (let i = 0; i < count; i++) {
        this._renderEntry(ctx, entries[i], i);
      }
    }

    // BACK button
    this._renderBackButton(ctx, cx);
  }

  _renderHeader(ctx) {
    ctx.fillStyle = '#666666';
    ctx.font = '8px "Press Start 2P"';
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'right';
    ctx.fillText('#', COL_RANK, HEADER_Y);

    ctx.textAlign = 'left';
    ctx.fillText('NICKNAME', COL_NICKNAME, HEADER_Y);

    ctx.textAlign = 'right';
    ctx.fillText('KILLS', COL_KILLS, HEADER_Y);

    ctx.textAlign = 'right';
    ctx.fillText('FLOOR', COL_FLOOR, HEADER_Y);

    ctx.textAlign = 'right';
    ctx.fillText('TIME', COL_TIME, HEADER_Y);
  }

  _renderEntry(ctx, entry, index) {
    const y = ENTRIES_START_Y + index * ROW_SPACING;
    const isPlayer = entry.guid === leaderboard.playerGuid;

    ctx.fillStyle = isPlayer ? '#00ffff' : '#ffffff';
    ctx.font = '9px "Press Start 2P"';
    ctx.textBaseline = 'middle';

    // Rank
    ctx.textAlign = 'right';
    ctx.fillText(String(index + 1), COL_RANK, y);

    // Nickname
    ctx.textAlign = 'left';
    ctx.fillText(entry.nickname || '???', COL_NICKNAME, y);

    // Kills
    ctx.textAlign = 'right';
    ctx.fillText(String(entry.enemiesKilled || 0), COL_KILLS, y);

    // Floor
    ctx.textAlign = 'right';
    ctx.fillText(String(entry.levelDepth), COL_FLOOR, y);

    // Time
    ctx.textAlign = 'right';
    ctx.fillText(this._formatTime(entry.runLength), COL_TIME, y);
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

  _formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  onInput(event) {}
}
