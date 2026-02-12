import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { audio } from '../systems/audio.js';

const MENU_ITEMS = [
  { label: 'Resume',    enabled: true },
  { label: 'Settings',  enabled: true },
  { label: 'Main Menu', enabled: true },
  { label: 'Quit',      enabled: false },
];

class PauseScene {
  constructor(game) {
    this.game = game;
    this.selectedIndex = 0;
    this.itemHitboxes = [];
  }

  enter() {
    this.selectedIndex = 0;
    audio.pauseGameplayMusic();
  }

  exit() {
    audio.unpauseGameplayMusic();
  }

  update(dt) {
    // Escape / pause action → resume
    if (input.isActionJustPressed('pause')) {
      audio.playSFX('unpause');
      this.game.popScene();
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

    // Mouse hover
    const mouse = input.getMousePos();
    for (let i = 0; i < this.itemHitboxes.length; i++) {
      const hb = this.itemHitboxes[i];
      if (!MENU_ITEMS[i].enabled) continue;
      if (
        mouse.x >= hb.x && mouse.x <= hb.x + hb.w &&
        mouse.y >= hb.y && mouse.y <= hb.y + hb.h
      ) {
        this.selectedIndex = i;
        break;
      }
    }

    // Mouse click
    if (input.isMouseJustPressed(0)) {
      for (let i = 0; i < this.itemHitboxes.length; i++) {
        const hb = this.itemHitboxes[i];
        if (!MENU_ITEMS[i].enabled) continue;
        if (
          mouse.x >= hb.x && mouse.x <= hb.x + hb.w &&
          mouse.y >= hb.y && mouse.y <= hb.y + hb.h
        ) {
          audio.playSFX('menuSelect');
          this._executeItem(i);
          break;
        }
      }
    }
  }

  render(ctx) {
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', CANVAS_WIDTH / 2, 150);

    // Menu items
    const startY = 300;
    const spacing = 60;
    const hitboxHeight = 40;
    const hitboxPadding = 20;
    this.itemHitboxes = [];

    ctx.font = '16px "Press Start 2P"';

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const item = MENU_ITEMS[i];
      const y = startY + i * spacing;

      let text;
      if (!item.enabled) {
        ctx.fillStyle = '#666666';
        text = item.label;
      } else if (i === this.selectedIndex) {
        ctx.fillStyle = '#00ffff';
        text = `> ${item.label} <`;
      } else {
        ctx.fillStyle = '#ffffff';
        text = item.label;
      }

      ctx.fillText(text, CANVAS_WIDTH / 2, y);

      // Cache hitbox
      const metrics = ctx.measureText(text);
      const w = metrics.width + hitboxPadding * 2;
      this.itemHitboxes.push({
        x: CANVAS_WIDTH / 2 - w / 2,
        y: y - hitboxHeight / 2,
        w,
        h: hitboxHeight,
      });
    }
  }

  onInput(event) {}

  // --- Navigation helpers ---

  _moveToNextEnabled() {
    const len = MENU_ITEMS.length;
    for (let offset = 1; offset < len; offset++) {
      const idx = (this.selectedIndex + offset) % len;
      if (MENU_ITEMS[idx].enabled) {
        this.selectedIndex = idx;
        return;
      }
    }
  }

  _moveToPreviousEnabled() {
    const len = MENU_ITEMS.length;
    for (let offset = 1; offset < len; offset++) {
      const idx = (this.selectedIndex - offset + len) % len;
      if (MENU_ITEMS[idx].enabled) {
        this.selectedIndex = idx;
        return;
      }
    }
  }

  _executeSelected() {
    if (MENU_ITEMS[this.selectedIndex].enabled) {
      this._executeItem(this.selectedIndex);
    }
  }

  _executeItem(index) {
    switch (index) {
      case 0: // Resume
        this.game.popScene();
        break;
      case 1: // Settings
        import('./settingsScene.js').then(({ SettingsScene }) => {
          this.game.pushScene(new SettingsScene(this.game));
        });
        break;
      case 2: // Main Menu
        audio.stopGameplayMusic();
        this.game.scenes[0]._returnFromGameplay = true;
        this.game.popScene(); // remove PauseScene
        this.game.popScene(); // remove GameplayScene
        break;
      // Quit is a stub — no action
    }
  }
}

export { PauseScene };
