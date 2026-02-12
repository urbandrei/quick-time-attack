import { CANVAS_WIDTH, CANVAS_HEIGHT } from './game.js';

const HALF_W = CANVAS_WIDTH / 2;
const HALF_H = CANVAS_HEIGHT / 2;

// ── Simple value-noise (smooth random) for organic shake ─────────────
// Uses a permutation table + cosine interpolation for smooth 1D noise.
const _PERM = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  _PERM.set(p);
  _PERM.set(p, 256);
}

function _hash(i) { return _PERM[i & 255]; }
function _grad(hash, x) { return (hash & 1) === 0 ? x : -x; }
function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

function perlinNoise1D(x) {
  const xi = Math.floor(x) & 255;
  const xf = x - Math.floor(x);
  const u = _fade(xf);
  const a = _grad(_hash(xi), xf);
  const b = _grad(_hash(xi + 1), xf - 1);
  return a + u * (b - a);
}

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.lerpSpeed = 8;
    this.leadFactor = 12;
    this.zoomLerpSpeed = 5;

    // Shake state — Perlin-noise driven
    this.shakeTrauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeDecay = 4;        // trauma units per second
    this.shakeMaxOffset = 16;   // max pixel displacement
    this._shakeSeed = Math.random() * 1000;
    this._shakeTime = 0;
  }

  /** Snap camera to a position immediately (no lerp). */
  snapTo(x, y) {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
  }

  update(dt, player, mouseScreenPos) {
    // Compute lead offset from mouse position relative to canvas center
    let leadX = 0;
    let leadY = 0;
    if (mouseScreenPos) {
      let mdx = mouseScreenPos.x - HALF_W;
      let mdy = mouseScreenPos.y - HALF_H;
      const dist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (dist > 1) {
        leadX = (mdx / dist) * this.leadFactor;
        leadY = (mdy / dist) * this.leadFactor;
      }
    }

    // Target = player center + lead offset
    this.targetX = player.x + leadX;
    this.targetY = player.y + leadY;

    // Lerp position toward target
    this.x += (this.targetX - this.x) * this.lerpSpeed * dt;
    this.y += (this.targetY - this.y) * this.lerpSpeed * dt;

    // Lerp zoom
    this.zoom += (this.targetZoom - this.zoom) * this.zoomLerpSpeed * dt;

    this._updateShake(dt);
  }

  applyTransform(ctx) {
    ctx.save();
    if (this.zoom !== 1) {
      ctx.translate(HALF_W, HALF_H);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-HALF_W, -HALF_H);
    }
    ctx.translate(HALF_W - this.x + this.shakeOffsetX, HALF_H - this.y + this.shakeOffsetY);
  }

  removeTransform(ctx) {
    ctx.restore();
  }

  /** Convert screen coordinates to world coordinates. */
  screenToWorld(screenX, screenY) {
    const wx = (screenX - HALF_W) / this.zoom + this.x;
    const wy = (screenY - HALF_H) / this.zoom + this.y;
    return { x: wx, y: wy };
  }

  /**
   * Add trauma to trigger screen shake. Trauma is squared to drive offset,
   * giving small hits a subtle shake and big hits a violent one.
   * @param {number} amount - Trauma to add (0–1 range, clamped)
   */
  shake(amount) {
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount);
  }

  _updateShake(dt) {
    if (this.shakeTrauma <= 0) {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      return;
    }

    this._shakeTime += dt * 15; // noise sampling speed
    const intensity = this.shakeTrauma * this.shakeTrauma; // squared for exponential falloff
    this.shakeOffsetX = this.shakeMaxOffset * intensity * perlinNoise1D(this._shakeSeed + this._shakeTime);
    this.shakeOffsetY = this.shakeMaxOffset * intensity * perlinNoise1D(this._shakeSeed + 100 + this._shakeTime);

    this.shakeTrauma = Math.max(0, this.shakeTrauma - this.shakeDecay * dt);
  }

  /** Punch zoom: brief zoom in, then lerps back to targetZoom (1.0). */
  zoomPunch(intensity = 0.1) {
    this.zoom = this.targetZoom + intensity;
    // targetZoom stays at 1.0, so zoom lerps back naturally
  }

  /** Camera kick: push camera away from a world point. */
  kick(fromX, fromY, strength = 20) {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.x += (dx / dist) * strength;
    this.y += (dy / dist) * strength;
  }
}
