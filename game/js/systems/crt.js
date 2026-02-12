import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';

const GRID_COLS = 24;
const GRID_ROWS = 18;
const BARREL_K = 0.08;       // fisheye strength
const SCANLINE_ALPHA = 0.07;
const SCANLINE_SPACING = 3;  // pixels between scanlines

class CRTEffect {
  constructor() {
    // Offscreen canvas — all game rendering goes here
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = CANVAS_WIDTH;
    this.offscreen.height = CANVAS_HEIGHT;
    this.offCtx = this.offscreen.getContext('2d');

    // Pre-compute barrel distortion grid (dest → source mapping)
    this.grid = this._buildGrid();

    // Pre-render static overlay (scanlines + vignette)
    this.overlayCanvas = this._buildOverlay();
  }

  /** Returns the offscreen context for game rendering */
  getContext() {
    return this.offCtx;
  }

  /** Apply CRT effects and composite onto the destination canvas */
  apply(destCtx) {
    // Barrel distortion — draw grid cells from offscreen with distorted source rects
    for (const cell of this.grid) {
      let { sx, sy, sw, sh, dx, dy, dw, dh } = cell;

      // Skip cells entirely outside source bounds
      if (sx >= CANVAS_WIDTH || sy >= CANVAS_HEIGHT || sx + sw <= 0 || sy + sh <= 0) continue;

      // Clamp source rect to canvas bounds, adjusting dest proportionally
      if (sx < 0) {
        const clip = -sx;
        dx += clip * (dw / sw);
        dw -= clip * (dw / sw);
        sw -= clip;
        sx = 0;
      }
      if (sy < 0) {
        const clip = -sy;
        dy += clip * (dh / sh);
        dh -= clip * (dh / sh);
        sh -= clip;
        sy = 0;
      }
      if (sx + sw > CANVAS_WIDTH) {
        const clip = sx + sw - CANVAS_WIDTH;
        dw -= clip * (dw / sw);
        sw -= clip;
      }
      if (sy + sh > CANVAS_HEIGHT) {
        const clip = sy + sh - CANVAS_HEIGHT;
        dh -= clip * (dh / sh);
        sh -= clip;
      }
      if (sw <= 0 || sh <= 0) continue;

      destCtx.drawImage(this.offscreen, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    // Scanlines + vignette
    destCtx.drawImage(this.overlayCanvas, 0, 0);
  }

  // ── Grid construction ──────────────────────────────────────────────────

  _buildGrid() {
    const grid = [];
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;
    const cellW = w / GRID_COLS;
    const cellH = h / GRID_ROWS;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        // Dest rect — regular grid
        const dx = col * cellW;
        const dy = row * cellH;

        // Source — barrel-distort all four corners
        const tl = this._distort(col / GRID_COLS, row / GRID_ROWS);
        const tr = this._distort((col + 1) / GRID_COLS, row / GRID_ROWS);
        const bl = this._distort(col / GRID_COLS, (row + 1) / GRID_ROWS);
        const br = this._distort((col + 1) / GRID_COLS, (row + 1) / GRID_ROWS);

        // Bounding box of distorted corners
        const sx = Math.min(tl.x, bl.x) * w;
        const sy = Math.min(tl.y, tr.y) * h;
        const sx2 = Math.max(tr.x, br.x) * w;
        const sy2 = Math.max(bl.y, br.y) * h;

        grid.push({
          sx, sy, sw: sx2 - sx, sh: sy2 - sy,
          dx, dy, dw: cellW, dh: cellH,
        });
      }
    }

    return grid;
  }

  /**
   * Compute the canvas transform for a HUD element at (px, py) so it
   * appears to sit on the curved screen surface.
   * Returns { x, y, rotation } — the offset position and tilt angle.
   */
  hudTransform(px, py) {
    const nx = (px / CANVAS_WIDTH - 0.5) * 2;   // -1..1
    const ny = (py / CANVAS_HEIGHT - 0.5) * 2;
    const r2 = nx * nx + ny * ny;
    // Inverse barrel: where does this source point land on the dest?
    const f = 1 - BARREL_K * r2;
    const dx = (nx * f / 2 + 0.5) * CANVAS_WIDTH;
    const dy = (ny * f / 2 + 0.5) * CANVAS_HEIGHT;
    // Rotation: slight tilt toward center based on horizontal position
    const rotation = -nx * BARREL_K * 0.6;
    return { x: dx, y: dy, rotation };
  }

  /** Map normalized (0..1) dest position to source position via barrel distortion */
  _distort(nx, ny) {
    const cx = (nx - 0.5) * 2; // -1..1
    const cy = (ny - 0.5) * 2;
    const r2 = cx * cx + cy * cy;
    const f = 1 + BARREL_K * r2;
    return {
      x: cx * f / 2 + 0.5,
      y: cy * f / 2 + 0.5,
    };
  }

  // ── Static overlay ─────────────────────────────────────────────────────

  _buildOverlay() {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    // Scanlines — thin dark lines every few pixels
    ctx.fillStyle = `rgba(0, 0, 0, ${SCANLINE_ALPHA})`;
    for (let y = 0; y < CANVAS_HEIGHT; y += SCANLINE_SPACING) {
      ctx.fillRect(0, y, CANVAS_WIDTH, 1);
    }

    // CRT vignette — strong edge darkening for monitor bezel feel
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const r = Math.sqrt(cx * cx + cy * cy);
    const grad = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.08)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    return canvas;
  }
}

export const crt = new CRTEffect();
