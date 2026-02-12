import { LEVEL_LAYOUTS, COFFEE_BREAK_LAYOUT, CHALLENGE_LAYOUT, POWER_UP_LAYOUT } from './levelData.js';

export const CHALLENGE_TYPES = {
  KILL_ALL: 'KILL_ALL',
  FIND_THE_KEY: 'FIND_THE_KEY',
  COFFEE_BREAK: 'COFFEE_BREAK',
  CHALLENGE: 'CHALLENGE',
  BOSS: 'BOSS',
  POWER_UP: 'POWER_UP',
};

export const CHALLENGE_DISPLAY_NAMES = {
  [CHALLENGE_TYPES.KILL_ALL]: 'KILL ALL',
  [CHALLENGE_TYPES.FIND_THE_KEY]: 'FIND THE KEY',
  [CHALLENGE_TYPES.COFFEE_BREAK]: 'COFFEE BREAK',
  [CHALLENGE_TYPES.CHALLENGE]: 'CHALLENGE',
  [CHALLENGE_TYPES.BOSS]: 'BOSS',
  [CHALLENGE_TYPES.POWER_UP]: 'POWER UP',
};

const NORMAL_TYPES = [
  CHALLENGE_TYPES.KILL_ALL,
  CHALLENGE_TYPES.FIND_THE_KEY,
  CHALLENGE_TYPES.CHALLENGE,
  CHALLENGE_TYPES.POWER_UP,
];

const COFFEE_BREAK_WEIGHT = 0.1;

export class LevelManager {
  constructor() {
    this.levelDepth = 0;
    this.challengeType = null;
    this.challengeHistory = [];
    this._lastLayoutIndex = -1;
    this._lastCoffeeBreakLevel = 0;
  }

  /**
   * Advance to the next level. Returns info about the new level.
   * @returns {{ levelDepth: number, challengeType: string, displayName: string, layout: object }}
   */
  advance() {
    this.levelDepth++;
    this.challengeType = this._selectChallengeType();
    this.challengeHistory.push(this.challengeType);

    let layout;
    if (this.challengeType === CHALLENGE_TYPES.COFFEE_BREAK) {
      layout = COFFEE_BREAK_LAYOUT;
    } else if (this.challengeType === CHALLENGE_TYPES.CHALLENGE
               || this.challengeType === CHALLENGE_TYPES.BOSS) {
      layout = CHALLENGE_LAYOUT;
    } else if (this.challengeType === CHALLENGE_TYPES.POWER_UP) {
      layout = POWER_UP_LAYOUT;
    } else {
      layout = this._selectLayout();
    }

    let keyRoomIndex = null;
    if (this.challengeType === CHALLENGE_TYPES.FIND_THE_KEY) {
      const startRoom = layout.playerStart.room;
      const candidates = layout.rooms.map((_, i) => i).filter(i => i !== startRoom);
      keyRoomIndex = candidates[Math.floor(Math.random() * candidates.length)];
    }

    return {
      levelDepth: this.levelDepth,
      challengeType: this.challengeType,
      displayName: CHALLENGE_DISPLAY_NAMES[this.challengeType],
      layout,
      keyRoomIndex,
    };
  }

  /** Reset all state for a new game. */
  reset() {
    this.levelDepth = 0;
    this.challengeType = null;
    this.challengeHistory = [];
    this._lastLayoutIndex = -1;
    this._lastCoffeeBreakLevel = 0;
  }

  /**
   * Select challenge type using semi-random rules:
   * - Boss every 5 levels
   * - Coffee break ~10% chance (no back-to-back)
   * - Otherwise random from normal types
   */
  _selectChallengeType() {
    // Boss every 5 levels
    if (this.levelDepth % 5 === 0) {
      return CHALLENGE_TYPES.BOSS;
    }

    const lastType = this.challengeHistory.length > 0
      ? this.challengeHistory[this.challengeHistory.length - 1]
      : null;

    // Coffee break ~10%, not before level 11, at least 5 levels apart
    const lastCoffee = this._lastCoffeeBreakLevel || 0;
    if (this.levelDepth >= 11
        && this.levelDepth - lastCoffee >= 5
        && Math.random() < COFFEE_BREAK_WEIGHT) {
      this._lastCoffeeBreakLevel = this.levelDepth;
      return CHALLENGE_TYPES.COFFEE_BREAK;
    }

    // Random from normal types, no back-to-back repeat (up to 3 re-rolls)
    let pick = NORMAL_TYPES[Math.floor(Math.random() * NORMAL_TYPES.length)];
    for (let i = 0; i < 3 && pick === lastType; i++) {
      pick = NORMAL_TYPES[Math.floor(Math.random() * NORMAL_TYPES.length)];
    }
    return pick;
  }

  /**
   * Pick a random layout, avoiding immediate repeats.
   */
  _selectLayout() {
    const count = LEVEL_LAYOUTS.length;
    if (count === 1) {
      this._lastLayoutIndex = 0;
      return LEVEL_LAYOUTS[0];
    }

    let idx;
    do {
      idx = Math.floor(Math.random() * count);
    } while (idx === this._lastLayoutIndex);

    this._lastLayoutIndex = idx;
    return LEVEL_LAYOUTS[idx];
  }
}
