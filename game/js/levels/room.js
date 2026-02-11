/** Default room configuration */
const DEFAULTS = {
  width: 480,
  height: 480,
  wallThickness: 16,
  floorColor: '#1a1a2e',
  wallColor: '#3a3a5e',
};

export class Room {
  /**
   * @param {object} opts
   * @param {number} opts.x - World-space X of the room's top-left corner
   * @param {number} opts.y - World-space Y of the room's top-left corner
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {number} [opts.wallThickness]
   * @param {string} [opts.floorColor]
   * @param {string} [opts.wallColor]
   * @param {Array<{rx: number, ry: number, type: string}>} [opts.spawnPoints]
   *        Relative coords (0-1) within the floor area, plus enemy type id
   */
  constructor({
    x = 0,
    y = 0,
    width = DEFAULTS.width,
    height = DEFAULTS.height,
    wallThickness = DEFAULTS.wallThickness,
    floorColor = DEFAULTS.floorColor,
    wallColor = DEFAULTS.wallColor,
    spawnPoints = [],
  } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.wallThickness = wallThickness;
    this.floorColor = floorColor;
    this.wallColor = wallColor;
    this.spawnPoints = spawnPoints;

    // Pre-compute inner floor bounds
    this.floorX = this.x + this.wallThickness;
    this.floorY = this.y + this.wallThickness;
    this.floorWidth = this.width - this.wallThickness * 2;
    this.floorHeight = this.height - this.wallThickness * 2;
  }

  /** Convert a relative spawn point to world coordinates. */
  spawnToWorld(rx, ry) {
    return {
      x: this.floorX + rx * this.floorWidth,
      y: this.floorY + ry * this.floorHeight,
    };
  }

  /** Return all spawn points as world-space positions. */
  getWorldSpawnPoints() {
    return this.spawnPoints.map((sp) => ({
      ...this.spawnToWorld(sp.rx, sp.ry),
      type: sp.type,
    }));
  }

  /**
   * Get the four wall rectangles as {x, y, w, h} for collision.
   * Walls are the border between the outer boundary and the inner floor.
   */
  getWalls() {
    const { x, y, width: w, height: h, wallThickness: t } = this;
    return [
      { x, y, w, h: t },           // top
      { x, y: y + h - t, w, h: t }, // bottom
      { x, y, w: t, h },           // left
      { x: x + w - t, y, w: t, h }, // right
    ];
  }

  render(ctx) {
    // Draw walls (full outer rect)
    ctx.fillStyle = this.wallColor;
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // Draw floor (inner rect)
    ctx.fillStyle = this.floorColor;
    ctx.fillRect(this.floorX, this.floorY, this.floorWidth, this.floorHeight);
  }
}
