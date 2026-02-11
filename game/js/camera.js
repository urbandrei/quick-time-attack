import { CANVAS_WIDTH, CANVAS_HEIGHT } from './game.js';

const HALF_W = CANVAS_WIDTH / 2;
const HALF_H = CANVAS_HEIGHT / 2;

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
  }

  applyTransform(ctx) {
    ctx.save();
    if (this.zoom !== 1) {
      ctx.translate(HALF_W, HALF_H);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-HALF_W, -HALF_H);
    }
    ctx.translate(HALF_W - this.x, HALF_H - this.y);
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

  /** Stub: punch zoom for juice (Step 64). */
  zoomPunch(intensity) {
    this.targetZoom = 1 + (intensity || 0.05);
  }

  /** Stub: offset kick from a world point (Step 64). */
  kick(fromX, fromY, strength) {
    // Will apply a directional offset toward the camera — implemented later
  }
}
