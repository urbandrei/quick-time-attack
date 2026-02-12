// ── Easing Functions ─────────────────────────────────────────────────

export const Easing = {
  linear:     (t) => t,
  inQuad:     (t) => t * t,
  outQuad:    (t) => t * (2 - t),
  inOutQuad:  (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  inCubic:    (t) => t * t * t,
  outCubic:   (t) => { const t1 = t - 1; return t1 * t1 * t1 + 1; },
  outQuart:   (t) => { const t1 = t - 1; return 1 - t1 * t1 * t1 * t1; },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  },
  outBack:    (t) => { const s = 1.70158; const t1 = t - 1; return t1 * t1 * ((s + 1) * t1 + s) + 1; },
  outBounce:  (t) => {
    if (t < 1 / 2.75)       return 7.5625 * t * t;
    if (t < 2 / 2.75)       { const t2 = t - 1.5 / 2.75;   return 7.5625 * t2 * t2 + 0.75; }
    if (t < 2.5 / 2.75)     { const t2 = t - 2.25 / 2.75;  return 7.5625 * t2 * t2 + 0.9375; }
    { const t2 = t - 2.625 / 2.75; return 7.5625 * t2 * t2 + 0.984375; }
  },
};

// ── Tween Manager ────────────────────────────────────────────────────

export class TweenManager {
  constructor() {
    this.tweens = [];
  }

  /**
   * Add a tween that animates target[prop] from `from` to `to` over `duration` seconds.
   * @param {object}   target     - Object to animate
   * @param {string}   prop       - Property name on target
   * @param {number}   from       - Start value
   * @param {number}   to         - End value
   * @param {number}   duration   - Duration in seconds
   * @param {function} [easing]   - Easing function (default: outQuad)
   * @param {function} [onComplete] - Called when tween finishes
   */
  add(target, prop, from, to, duration, easing = Easing.outQuad, onComplete = null) {
    this.tweens.push({ target, prop, from, to, duration, easing, onComplete, timer: 0 });
  }

  update(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.timer += dt;

      if (tw.timer >= tw.duration) {
        tw.target[tw.prop] = tw.to;
        if (tw.onComplete) tw.onComplete();
        this.tweens.splice(i, 1);
      } else {
        const t = tw.easing(tw.timer / tw.duration);
        tw.target[tw.prop] = tw.from + (tw.to - tw.from) * t;
      }
    }
  }
}

/** Singleton instance for convenience. */
export const tweens = new TweenManager();
