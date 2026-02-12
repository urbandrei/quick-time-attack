import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import {
  VOLUME_STORAGE_KEY,
  DEFAULT_VOLUMES,
  ACTIONS,
  VOLUME_ROWS,
  BOTTOM_ITEMS,
  BINDING_ROW_COUNT,
  VOLUME_ROW_START,
  BOTTOM_ROW_START,
  TITLE_Y,
  BINDINGS_START_Y,
  BINDINGS_SPACING,
  VOLUME_START_Y,
  VOLUME_SPACING,
  BOTTOM_START_Y,
  BOTTOM_SPACING,
  LABEL_X,
  SLOT1_X,
  SLOT2_X,
  SLOT_WIDTH,
  SLOT_HEIGHT,
  VOLUME_BAR_X,
  VOLUME_BAR_WIDTH,
  VOLUME_BAR_HEIGHT,
  VOLUME_PCT_X,
  TITLE_COLOR,
  LABEL_COLOR,
  LABEL_SELECTED_COLOR,
  SLOT_BG_COLOR,
  SLOT_SELECTED_BG_COLOR,
  SLOT_TEXT_COLOR,
  SLOT_EMPTY_COLOR,
  REBINDING_COLOR,
  SELECTED_ITEM_COLOR,
  NORMAL_ITEM_COLOR,
  VOLUME_BAR_BG_COLOR,
  VOLUME_BAR_FILL_COLOR,
  HINT_COLOR,
  getKeyDisplayName,
} from '../menus/settings.js';

export class SettingsScene {
  constructor(game) {
    this.game = game;
    this.selectedRow = -1;  // nothing highlighted until mouse hovers
    this.selectedSlot = -1;
    this.rebinding = false;
    this.volumes = this._loadVolumes();

    // Hitboxes for mouse interaction (populated during render)
    this.rowHitboxes = [];
    this.slotHitboxes = []; // array of { slot0: rect, slot1: rect } per binding row
    this.volumeBarHitboxes = []; // array of rect per volume row

    // Mouse movement tracking — hover only updates selection when mouse moves
    this._lastMouseX = -1;
    this._lastMouseY = -1;

    // Volume slider drag state
    this._draggingVolume = null; // index into VOLUME_ROWS while dragging
  }

  enter() {
    this.selectedRow = -1;
    this.selectedSlot = -1;
    this.rebinding = false;
  }

  exit() {}

  update(dt) {
    if (this.rebinding) return;

    // Escape → back
    if (input.isActionJustPressed('pause')) {
      this.game.popScene();
      return;
    }

    // Mouse hover — only when mouse has moved
    const mouse = input.getMousePos();
    const mouseMoved = mouse.x !== this._lastMouseX || mouse.y !== this._lastMouseY;
    if (mouseMoved) {
      this._lastMouseX = mouse.x;
      this._lastMouseY = mouse.y;
      this._handleMouseHover(mouse);
    }

    // Volume slider drag
    if (this._draggingVolume != null) {
      if (input.isMouseDown(0)) {
        this._dragVolume(mouse);
      } else {
        this._draggingVolume = null;
      }
    }

    // Left click
    if (input.isMouseJustPressed(0)) {
      this._handleMouseClick(mouse);
    }

    // Right click — clear binding slot
    if (input.isMouseJustPressed(2)) {
      this._handleRightClick(mouse);
    }
  }

  render(ctx) {
    // Semi-transparent overlay
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;

    // Title
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = '24px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SETTINGS', cx, TITLE_Y);

    // Reset hitboxes
    this.rowHitboxes = [];
    this.slotHitboxes = [];
    this.volumeBarHitboxes = [];

    this._renderBindingRows(ctx);
    this._renderVolumeRows(ctx);
    this._renderBottomItems(ctx, cx);

    // Hint at bottom
    this._renderHint(ctx, cx);
  }

  onInput(event) {
    if (!this.rebinding) return;
    if (event.type !== 'keydown') return;
    if (event.repeat) return;

    if (event.code === 'Escape') {
      this.rebinding = false;
      return;
    }

    this._rebindSlot(event.code);
    this.rebinding = false;
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  _renderBindingRows(ctx) {
    const actionMap = input.getActionMap();

    ctx.font = '8px "Press Start 2P"';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < ACTIONS.length; i++) {
      const action = ACTIONS[i];
      const y = BINDINGS_START_Y + i * BINDINGS_SPACING;
      const isSelected = this.selectedRow === i;
      const codes = actionMap[action.id] || [];

      // Label
      ctx.fillStyle = isSelected ? LABEL_SELECTED_COLOR : LABEL_COLOR;
      ctx.textAlign = 'left';
      ctx.fillText(action.label, LABEL_X, y);

      // Slot boxes
      const slot0Code = codes[0] || null;
      const slot1Code = codes[1] || null;

      const s0x = SLOT1_X;
      const s1x = SLOT2_X;
      const sy = y - SLOT_HEIGHT / 2;

      this._renderSlot(ctx, s0x, sy, slot0Code, isSelected && this.selectedSlot === 0);
      this._renderSlot(ctx, s1x, sy, slot1Code, isSelected && this.selectedSlot === 1);

      // Store hitboxes
      this.slotHitboxes.push({
        slot0: { x: s0x, y: sy, w: SLOT_WIDTH, h: SLOT_HEIGHT },
        slot1: { x: s1x, y: sy, w: SLOT_WIDTH, h: SLOT_HEIGHT },
      });

      // Row hitbox (entire row for hover)
      this.rowHitboxes.push({
        x: LABEL_X - 10,
        y: sy,
        w: SLOT2_X + SLOT_WIDTH - LABEL_X + 20,
        h: SLOT_HEIGHT,
      });
    }
  }

  _renderSlot(ctx, x, y, code, isActive) {
    const isRebinding = isActive && this.rebinding;

    // Background
    ctx.fillStyle = isActive ? SLOT_SELECTED_BG_COLOR : SLOT_BG_COLOR;
    ctx.fillRect(x, y, SLOT_WIDTH, SLOT_HEIGHT);

    // Border when active
    if (isActive) {
      ctx.strokeStyle = isRebinding ? REBINDING_COLOR : SELECTED_ITEM_COLOR;
      ctx.lineWidth = isRebinding ? 2 : 1;
      ctx.strokeRect(x, y, SLOT_WIDTH, SLOT_HEIGHT);
    }

    // Text
    ctx.textAlign = 'center';
    ctx.font = '8px "Press Start 2P"';
    if (isRebinding) {
      ctx.fillStyle = REBINDING_COLOR;
      ctx.fillText('...', x + SLOT_WIDTH / 2, y + SLOT_HEIGHT / 2);
    } else if (code) {
      ctx.fillStyle = SLOT_TEXT_COLOR;
      ctx.fillText(getKeyDisplayName(code), x + SLOT_WIDTH / 2, y + SLOT_HEIGHT / 2);
    } else {
      ctx.fillStyle = SLOT_EMPTY_COLOR;
      ctx.fillText('---', x + SLOT_WIDTH / 2, y + SLOT_HEIGHT / 2);
    }
  }

  _renderVolumeRows(ctx) {
    ctx.font = '8px "Press Start 2P"';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < VOLUME_ROWS.length; i++) {
      const row = VOLUME_ROWS[i];
      const globalRow = VOLUME_ROW_START + i;
      const y = VOLUME_START_Y + i * VOLUME_SPACING;
      const isSelected = this.selectedRow === globalRow;
      const value = this.volumes[row.id];

      // Label
      ctx.fillStyle = isSelected ? LABEL_SELECTED_COLOR : LABEL_COLOR;
      ctx.textAlign = 'left';
      ctx.fillText(row.label, LABEL_X, y);

      // Bar background
      const barY = y - VOLUME_BAR_HEIGHT / 2;
      ctx.fillStyle = VOLUME_BAR_BG_COLOR;
      ctx.fillRect(VOLUME_BAR_X, barY, VOLUME_BAR_WIDTH, VOLUME_BAR_HEIGHT);

      // Bar fill
      ctx.fillStyle = isSelected ? SELECTED_ITEM_COLOR : VOLUME_BAR_FILL_COLOR;
      ctx.fillRect(VOLUME_BAR_X, barY, VOLUME_BAR_WIDTH * value, VOLUME_BAR_HEIGHT);

      // Border when selected
      if (isSelected) {
        ctx.strokeStyle = SELECTED_ITEM_COLOR;
        ctx.lineWidth = 1;
        ctx.strokeRect(VOLUME_BAR_X, barY, VOLUME_BAR_WIDTH, VOLUME_BAR_HEIGHT);
      }

      // Percentage
      ctx.fillStyle = isSelected ? LABEL_SELECTED_COLOR : LABEL_COLOR;
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(value * 100)}%`, VOLUME_PCT_X, y);

      // Volume bar hitbox (for drag)
      this.volumeBarHitboxes.push({
        x: VOLUME_BAR_X,
        y: barY,
        w: VOLUME_BAR_WIDTH,
        h: VOLUME_BAR_HEIGHT,
      });

      // Row hitbox (entire row for hover)
      this.rowHitboxes.push({
        x: LABEL_X - 10,
        y: barY,
        w: VOLUME_PCT_X + 60 - LABEL_X + 10,
        h: VOLUME_BAR_HEIGHT,
      });
    }
  }

  _renderBottomItems(ctx, cx) {
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < BOTTOM_ITEMS.length; i++) {
      const item = BOTTOM_ITEMS[i];
      const globalRow = BOTTOM_ROW_START + i;
      const y = BOTTOM_START_Y + i * BOTTOM_SPACING;
      const isSelected = this.selectedRow === globalRow;

      let text;
      if (isSelected) {
        ctx.fillStyle = SELECTED_ITEM_COLOR;
        text = `> ${item.label} <`;
      } else {
        ctx.fillStyle = NORMAL_ITEM_COLOR;
        text = item.label;
      }

      ctx.fillText(text, cx, y);

      // Row hitbox
      const metrics = ctx.measureText(text);
      const w = metrics.width + 20;
      this.rowHitboxes.push({
        x: cx - w / 2,
        y: y - 18,
        w,
        h: 36,
      });
    }
  }

  _renderHint(ctx, cx) {
    ctx.fillStyle = HINT_COLOR;
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.rebinding) {
      ctx.fillText('Press a key to bind, ESC to cancel', cx, CANVAS_HEIGHT - 25);
    } else if (this.selectedRow >= 0 && this.selectedRow < BINDING_ROW_COUNT) {
      ctx.fillText('Click to rebind, right-click to clear', cx, CANVAS_HEIGHT - 25);
    } else if (this.selectedRow >= VOLUME_ROW_START && this.selectedRow < BOTTOM_ROW_START) {
      ctx.fillText('Click and drag to adjust', cx, CANVAS_HEIGHT - 25);
    }
  }

  // ── Binding logic ──────────────────────────────────────────────────────

  _rebindSlot(code) {
    const action = ACTIONS[this.selectedRow];
    if (!action) return;

    const currentCodes = input.getActionMap()[action.id] || [];
    const newCodes = [...currentCodes];

    // Ensure array has at least selectedSlot+1 entries
    while (newCodes.length <= this.selectedSlot) {
      newCodes.push(null);
    }

    newCodes[this.selectedSlot] = code;

    // Filter out nulls, then pass to setBinding
    const filtered = newCodes.filter(c => c != null);
    if (filtered.length > 0) {
      input.setBinding(action.id, filtered);
    }
  }

  _clearBinding(rowIndex, slotIndex) {
    const action = ACTIONS[rowIndex];
    if (!action) return;

    const currentCodes = input.getActionMap()[action.id] || [];
    if (slotIndex >= currentCodes.length) return;

    const newCodes = currentCodes.filter((_, i) => i !== slotIndex);

    // Don't allow clearing the last binding
    if (newCodes.length === 0) return;

    input.setBinding(action.id, newCodes);
  }

  // ── Volume logic ───────────────────────────────────────────────────────

  _loadVolumes() {
    try {
      const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        return {
          sfx: typeof stored.sfx === 'number' ? stored.sfx : DEFAULT_VOLUMES.sfx,
          music: typeof stored.music === 'number' ? stored.music : DEFAULT_VOLUMES.music,
        };
      }
    } catch { /* corrupted — use defaults */ }
    return { ...DEFAULT_VOLUMES };
  }

  _saveVolumes() {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(this.volumes));
    } catch { /* silent fail */ }
  }

  // ── Bottom buttons ─────────────────────────────────────────────────────

  _executeButton() {
    const buttonIndex = this.selectedRow - BOTTOM_ROW_START;
    const item = BOTTOM_ITEMS[buttonIndex];
    if (!item) return;

    switch (item.id) {
      case 'reset':
        input.resetToDefaults();
        this.volumes = { ...DEFAULT_VOLUMES };
        this._saveVolumes();
        break;
      case 'back':
        this.game.popScene();
        break;
    }
  }

  // ── Mouse ──────────────────────────────────────────────────────────────

  _handleMouseHover(mouse) {
    // Check slot hitboxes first (more specific than row hitboxes)
    for (let i = 0; i < this.slotHitboxes.length; i++) {
      const slots = this.slotHitboxes[i];
      if (this._hitTest(mouse, slots.slot0)) {
        this.selectedRow = i;
        this.selectedSlot = 0;
        return;
      }
      if (this._hitTest(mouse, slots.slot1)) {
        this.selectedRow = i;
        this.selectedSlot = 1;
        return;
      }
    }

    // Check general row hitboxes (volume + bottom items)
    for (let i = BINDING_ROW_COUNT; i < this.rowHitboxes.length; i++) {
      if (this._hitTest(mouse, this.rowHitboxes[i])) {
        this.selectedRow = i;
        return;
      }
    }
  }

  _handleMouseClick(mouse) {
    // Click on volume bar → start drag
    for (let i = 0; i < this.volumeBarHitboxes.length; i++) {
      if (this._hitTest(mouse, this.volumeBarHitboxes[i])) {
        this.selectedRow = VOLUME_ROW_START + i;
        this._draggingVolume = i;
        this._dragVolume(mouse);
        return;
      }
    }

    // Click on binding slot → start rebinding
    for (let i = 0; i < this.slotHitboxes.length; i++) {
      const slots = this.slotHitboxes[i];
      if (this._hitTest(mouse, slots.slot0)) {
        this.selectedRow = i;
        this.selectedSlot = 0;
        this.rebinding = true;
        return;
      }
      if (this._hitTest(mouse, slots.slot1)) {
        this.selectedRow = i;
        this.selectedSlot = 1;
        this.rebinding = true;
        return;
      }
    }

    // Click on bottom items → execute
    for (let i = BOTTOM_ROW_START; i < this.rowHitboxes.length; i++) {
      if (this._hitTest(mouse, this.rowHitboxes[i])) {
        this.selectedRow = i;
        this._executeButton();
        return;
      }
    }
  }

  _handleRightClick(mouse) {
    for (let i = 0; i < this.slotHitboxes.length; i++) {
      const slots = this.slotHitboxes[i];
      if (this._hitTest(mouse, slots.slot0)) {
        this._clearBinding(i, 0);
        return;
      }
      if (this._hitTest(mouse, slots.slot1)) {
        this._clearBinding(i, 1);
        return;
      }
    }
  }

  _dragVolume(mouse) {
    if (this._draggingVolume == null) return;
    const bar = this.volumeBarHitboxes[this._draggingVolume];
    if (!bar) return;

    const row = VOLUME_ROWS[this._draggingVolume];
    if (!row) return;

    // Map mouse X to 0–1 within the bar
    const t = Math.max(0, Math.min(1, (mouse.x - bar.x) / bar.w));
    this.volumes[row.id] = Math.round(t * 10) / 10;
    this._saveVolumes();
  }

  _hitTest(mouse, rect) {
    if (!rect) return false;
    return mouse.x >= rect.x && mouse.x <= rect.x + rect.w
        && mouse.y >= rect.y && mouse.y <= rect.y + rect.h;
  }
}
