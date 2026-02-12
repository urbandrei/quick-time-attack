const STORAGE_KEY = 'qta_seen_tutorials';

const TUTORIAL_TEXT = {
  intro: [
    'WASD TO MOVE',
    'SHIFT TO DASH',
    'RUN INTO ENEMIES TO FIGHT',
  ],
  KILL_ALL: [
    'KILL ALL ENEMIES',
    'TO OPEN THE EXIT',
  ],
  FIND_THE_KEY: [
    'FIND THE KEY',
    'AND BRING IT BACK',
  ],
  COFFEE_BREAK: [
    'TAKE A BREAK',
    'YOU EARNED IT',
  ],
  CHALLENGE: [
    'SURVIVE THE WAVES',
    'OR FLEE AND LOSE A HEART',
    'WAIT TILL THE CIRCLE GOES GREEN',
  ],
  BOSS: [
    'DEFEAT THE BOSS',
    'COMPLETE 5 QTES TO WIN',
  ],
  POWER_UP: [
    'ACTIVATE ALL GENERATORS',
    'IN THE SURROUNDING ROOMS',
  ],
};

class TutorialManager {
  constructor() {
    this.seen = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  }

  /**
   * Returns intro control lines for the main menu floor, or [].
   * Marks intro as seen immediately.
   */
  getIntroLines() {
    if (this.seen.has('intro')) return [];
    this.seen.add('intro');
    this._save();
    return [...TUTORIAL_TEXT.intro];
  }

  /**
   * Returns challenge-specific lines for the gameplay floor, or [].
   * Marks returned tutorial IDs as seen immediately.
   */
  getLines(challengeType) {
    if (!challengeType || !TUTORIAL_TEXT[challengeType] || this.seen.has(challengeType)) return [];
    this.seen.add(challengeType);
    this._save();
    return [...TUTORIAL_TEXT[challengeType]];
  }

  reset() {
    this.seen.clear();
    localStorage.removeItem(STORAGE_KEY);
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seen]));
  }
}

export const tutorials = new TutorialManager();
