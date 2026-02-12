// Settings screen layout constants

export const VOLUME_STORAGE_KEY = 'qta_volume';
export const DEFAULT_VOLUMES = { sfx: 0.8, music: 0.8 };
export const VOLUME_STEP = 0.1;

export const ACTIONS = [
  { id: 'moveUp',    label: 'MOVE UP' },
  { id: 'moveDown',  label: 'MOVE DOWN' },
  { id: 'moveLeft',  label: 'MOVE LEFT' },
  { id: 'moveRight', label: 'MOVE RIGHT' },
  { id: 'interact',  label: 'INTERACT' },
  { id: 'pause',     label: 'PAUSE' },
];

export const VOLUME_ROWS = [
  { id: 'sfx',   label: 'SFX VOLUME' },
  { id: 'music', label: 'MUSIC VOLUME' },
];

export const BOTTOM_ITEMS = [
  { id: 'reset', label: 'RESET DEFAULTS' },
  { id: 'back',  label: 'BACK' },
];

// Total row counts (for navigation math)
export const BINDING_ROW_COUNT = ACTIONS.length;                     // 6
export const VOLUME_ROW_START = BINDING_ROW_COUNT;                   // 6
export const VOLUME_ROW_COUNT = VOLUME_ROWS.length;                  // 2
export const BOTTOM_ROW_START = VOLUME_ROW_START + VOLUME_ROW_COUNT; // 8
export const BOTTOM_ROW_COUNT = BOTTOM_ITEMS.length;                 // 2
export const TOTAL_ROWS = BOTTOM_ROW_START + BOTTOM_ROW_COUNT;       // 10

// Layout positions
export const TITLE_Y = 45;
export const BINDINGS_START_Y = 105;
export const BINDINGS_SPACING = 32;
export const VOLUME_START_Y = 315;
export const VOLUME_SPACING = 38;
export const BOTTOM_START_Y = 430;
export const BOTTOM_SPACING = 45;

// Column positions
export const LABEL_X = 160;
export const SLOT1_X = 445;
export const SLOT2_X = 575;
export const SLOT_WIDTH = 110;
export const SLOT_HEIGHT = 24;

// Volume bar
export const VOLUME_BAR_X = 410;
export const VOLUME_BAR_WIDTH = 200;
export const VOLUME_BAR_HEIGHT = 16;
export const VOLUME_PCT_X = 640;

// Colors
export const TITLE_COLOR = '#ffffff';
export const LABEL_COLOR = '#888888';
export const LABEL_SELECTED_COLOR = '#ffffff';
export const SLOT_BG_COLOR = 'rgba(255, 255, 255, 0.08)';
export const SLOT_SELECTED_BG_COLOR = 'rgba(0, 255, 255, 0.2)';
export const SLOT_TEXT_COLOR = '#ffffff';
export const SLOT_EMPTY_COLOR = '#555555';
export const REBINDING_COLOR = '#44ff88';
export const SELECTED_ITEM_COLOR = '#00ffff';
export const NORMAL_ITEM_COLOR = '#ffffff';
export const VOLUME_BAR_BG_COLOR = '#333333';
export const VOLUME_BAR_FILL_COLOR = '#44ff88';
export const HINT_COLOR = '#555555';

// Key display names for common codes
const KEY_NAMES = {
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC',
  ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT',
  ControlLeft: 'LCTRL', ControlRight: 'RCTRL',
  AltLeft: 'LALT', AltRight: 'RALT',
  Tab: 'TAB', Backspace: 'BKSP', Delete: 'DEL',
  CapsLock: 'CAPS', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Minus: '-', Equal: '=', Backquote: '`',
};

export function getKeyDisplayName(code) {
  if (!code) return '---';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6);
  return code;
}
