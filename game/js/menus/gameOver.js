// Game over screen layout constants

export const NICKNAME_MAX_LENGTH = 10;
export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_STORAGE_KEY = 'qta_last_nickname';

export const MENU_ITEMS = [
  { id: 'submit',    label: 'Submit Run', enabled: true },
  { id: 'playAgain', label: 'Play Again', enabled: true },
  { id: 'mainMenu',  label: 'Main Menu',  enabled: true },
];

// Visual constants
export const TITLE_Y = 100;
export const STATS_START_Y = 175;
export const STATS_SPACING = 28;
export const NICKNAME_Y = 295;
export const MENU_START_Y = 390;
export const MENU_SPACING = 50;
export const MENU_HITBOX_HEIGHT = 36;
export const MENU_HITBOX_PADDING = 16;

// Colors
export const TITLE_COLOR = '#ff4444';
export const STAT_LABEL_COLOR = '#888888';
export const STAT_VALUE_COLOR = '#ffffff';
export const NICKNAME_ACTIVE_COLOR = '#44ff88';
export const NICKNAME_INACTIVE_COLOR = '#aaaaaa';
export const INPUT_BG_COLOR = 'rgba(255, 255, 255, 0.08)';
export const INPUT_CURSOR_COLOR = '#44ff88';
export const SELECTED_ITEM_COLOR = '#00ffff';
export const NORMAL_ITEM_COLOR = '#ffffff';
export const DISABLED_ITEM_COLOR = '#666666';
