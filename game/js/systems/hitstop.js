export class HitstopManager {
  constructor() {
    this.freezeTimer = 0;
  }

  /**
   * Trigger a freeze for the given number of frames (at 60fps).
   * If already frozen, takes the longer remaining duration.
   * @param {number} frames
   */
  freeze(frames) {
    this.freezeTimer = Math.max(this.freezeTimer, frames / 60);
  }

  /**
   * Call every frame. Returns true if the game should skip entity updates.
   * @param {number} dt
   * @returns {boolean}
   */
  update(dt) {
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      return true; // frozen
    }
    return false; // not frozen
  }

  get active() {
    return this.freezeTimer > 0;
  }
}
