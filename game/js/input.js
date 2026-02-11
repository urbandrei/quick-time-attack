const DEFAULT_ACTION_MAP = {
  moveUp:    ['KeyW', 'ArrowUp'],
  moveDown:  ['KeyS', 'ArrowDown'],
  moveLeft:  ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  interact:  ['KeyE'],
  pause:     ['Escape'],
};

const STORAGE_KEY = 'qta_keybindings';

class InputManager {
  constructor() {
    this._keysDown = new Set();
    this._keysJustPressed = new Set();
    this._keysJustReleased = new Set();

    this._mousePos = { x: 0, y: 0 };
    this._mouseButtons = new Set();
    this._mouseJustPressed = new Set();
    this._mouseJustReleased = new Set();

    this._canvas = null;
    this._actionMap = {};
    this._boundCodes = new Set();

    this._loadMappings();
  }

  init(canvas) {
    this._canvas = canvas;

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    window.addEventListener('blur', () => this._onBlur());

    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // --- Polling: keys ---

  isKeyDown(code) {
    return this._keysDown.has(code);
  }

  isKeyJustPressed(code) {
    return this._keysJustPressed.has(code);
  }

  isKeyJustReleased(code) {
    return this._keysJustReleased.has(code);
  }

  // --- Polling: actions ---

  isActionDown(action) {
    const codes = this._actionMap[action];
    if (!codes) return false;
    for (const code of codes) {
      if (this._keysDown.has(code)) return true;
    }
    return false;
  }

  isActionJustPressed(action) {
    const codes = this._actionMap[action];
    if (!codes) return false;
    for (const code of codes) {
      if (this._keysJustPressed.has(code)) return true;
    }
    return false;
  }

  // --- Polling: mouse ---

  getMousePos() {
    return { x: this._mousePos.x, y: this._mousePos.y };
  }

  isMouseDown(button = 0) {
    return this._mouseButtons.has(button);
  }

  isMouseJustPressed(button = 0) {
    return this._mouseJustPressed.has(button);
  }

  isMouseJustReleased(button = 0) {
    return this._mouseJustReleased.has(button);
  }

  // --- Lifecycle ---

  endFrame() {
    this._keysJustPressed.clear();
    this._keysJustReleased.clear();
    this._mouseJustPressed.clear();
    this._mouseJustReleased.clear();
  }

  // --- Remapping ---

  getActionMap() {
    const copy = {};
    for (const [action, codes] of Object.entries(this._actionMap)) {
      copy[action] = [...codes];
    }
    return copy;
  }

  setBinding(action, codes) {
    if (!Array.isArray(codes) || codes.length === 0) return;
    this._actionMap[action] = [...codes];
    this._rebuildBoundCodes();
    this._saveMappings();
  }

  resetToDefaults() {
    this._actionMap = {};
    for (const [action, codes] of Object.entries(DEFAULT_ACTION_MAP)) {
      this._actionMap[action] = [...codes];
    }
    this._rebuildBoundCodes();
    this._saveMappings();
  }

  // --- Internal: DOM handlers ---

  _onKeyDown(e) {
    if (e.repeat) return;

    if (this._boundCodes.has(e.code)) {
      e.preventDefault();
    }

    this._keysDown.add(e.code);
    this._keysJustPressed.add(e.code);
  }

  _onKeyUp(e) {
    this._keysDown.delete(e.code);
    this._keysJustReleased.add(e.code);
  }

  _onBlur() {
    this._keysDown.clear();
    this._keysJustPressed.clear();
    this._keysJustReleased.clear();
    this._mouseButtons.clear();
    this._mouseJustPressed.clear();
    this._mouseJustReleased.clear();
  }

  _onMouseDown(e) {
    this._mouseButtons.add(e.button);
    this._mouseJustPressed.add(e.button);
    this._updateMousePos(e);
  }

  _onMouseMove(e) {
    this._updateMousePos(e);
  }

  _onMouseUp(e) {
    this._mouseButtons.delete(e.button);
    this._mouseJustReleased.add(e.button);
  }

  _updateMousePos(e) {
    if (!this._canvas) return;
    const rect = this._canvas.getBoundingClientRect();
    this._mousePos.x = ((e.clientX - rect.left) / rect.width) * this._canvas.width;
    this._mousePos.y = ((e.clientY - rect.top) / rect.height) * this._canvas.height;
  }

  // --- Internal: persistence ---

  _loadMappings() {
    // Start with defaults
    this._actionMap = {};
    for (const [action, codes] of Object.entries(DEFAULT_ACTION_MAP)) {
      this._actionMap[action] = [...codes];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          for (const [action, codes] of Object.entries(stored)) {
            // Only restore actions that exist in defaults, and validate value is string array
            if (action in DEFAULT_ACTION_MAP && Array.isArray(codes) && codes.every(c => typeof c === 'string')) {
              this._actionMap[action] = [...codes];
            }
          }
        }
      }
    } catch {
      // Corrupted data — keep defaults
    }

    this._rebuildBoundCodes();
  }

  _saveMappings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._actionMap));
    } catch {
      // Storage full or unavailable — silent fail
    }
  }

  _rebuildBoundCodes() {
    this._boundCodes.clear();
    for (const codes of Object.values(this._actionMap)) {
      for (const code of codes) {
        this._boundCodes.add(code);
      }
    }
  }
}

export { InputManager };
export const input = new InputManager();
