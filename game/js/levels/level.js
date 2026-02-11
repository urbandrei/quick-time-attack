import { Room } from './room.js';

const HALLWAY_WIDTH = 96;
const DEFAULT_WALL_THICKNESS = 16;
const FLOOR_COLOR = '#1a1a2e';
const WALL_COLOR = '#3a3a5e';

export class Level {
  /**
   * @param {object} layoutData - A layout from LEVEL_LAYOUTS
   */
  constructor(layoutData) {
    this.rooms = layoutData.rooms.map(r => new Room(r));
    this.hallways = this._buildHallways(layoutData.hallways);
    this.walls = this._buildWalls();

    // Compute player start position
    const startRoom = this.rooms[layoutData.playerStart.room];
    const start = startRoom.spawnToWorld(
      layoutData.playerStart.rx,
      layoutData.playerStart.ry,
    );
    this.playerStartX = start.x;
    this.playerStartY = start.y;
  }

  // ── Hallway construction ──────────────────────────────────────────

  _buildHallways(hallwayDefs) {
    return hallwayDefs.map(def => {
      const fromRoom = this.rooms[def.from];
      const toRoom = this.rooms[def.to];
      const isHorizontal =
        def.fromSide === 'right' || def.fromSide === 'left';

      if (isHorizontal) {
        return this._buildHorizontalHallway(
          fromRoom, def.from, toRoom, def.to,
          def.fromSide, def.toSide, def.offset,
        );
      }
      return this._buildVerticalHallway(
        fromRoom, def.from, toRoom, def.to,
        def.fromSide, def.toSide, def.offset,
      );
    });
  }

  _buildHorizontalHallway(fromRoom, fromIdx, toRoom, toIdx, fromSide, toSide, offset) {
    const t = DEFAULT_WALL_THICKNESS;

    // Determine left / right room
    let leftRoom, leftIdx, rightRoom, rightIdx;
    if (fromSide === 'right') {
      leftRoom = fromRoom; leftIdx = fromIdx;
      rightRoom = toRoom;  rightIdx = toIdx;
    } else {
      leftRoom = toRoom;   leftIdx = toIdx;
      rightRoom = fromRoom; rightIdx = fromIdx;
    }

    // Hallway centre Y derived from the "from" room
    const centerY = fromRoom.floorY + offset * fromRoom.floorHeight;

    // Gap between outer edges of the two rooms
    const gapX = leftRoom.x + leftRoom.width;
    const gapW = rightRoom.x - gapX;

    // Floor extends into both room walls so the opening is visually clean
    const floor = {
      x: gapX - t,
      y: centerY - HALLWAY_WIDTH / 2,
      w: gapW + t * 2,
      h: HALLWAY_WIDTH,
    };

    // Side walls span the gap only (room walls handle the rest)
    const sideWalls = [
      { x: gapX, y: centerY - HALLWAY_WIDTH / 2 - t, w: gapW, h: t },
      { x: gapX, y: centerY + HALLWAY_WIDTH / 2,     w: gapW, h: t },
    ];

    // Openings cut into room walls (Y-axis range)
    const openings = [
      {
        roomIndex: leftIdx, side: 'right',
        start: centerY - HALLWAY_WIDTH / 2,
        end:   centerY + HALLWAY_WIDTH / 2,
      },
      {
        roomIndex: rightIdx, side: 'left',
        start: centerY - HALLWAY_WIDTH / 2,
        end:   centerY + HALLWAY_WIDTH / 2,
      },
    ];

    return { floor, sideWalls, openings, floorColor: FLOOR_COLOR, wallColor: WALL_COLOR };
  }

  _buildVerticalHallway(fromRoom, fromIdx, toRoom, toIdx, fromSide, toSide, offset) {
    const t = DEFAULT_WALL_THICKNESS;

    // Determine top / bottom room
    let topRoom, topIdx, bottomRoom, bottomIdx;
    if (fromSide === 'bottom') {
      topRoom = fromRoom;  topIdx = fromIdx;
      bottomRoom = toRoom; bottomIdx = toIdx;
    } else {
      topRoom = toRoom;     topIdx = toIdx;
      bottomRoom = fromRoom; bottomIdx = fromIdx;
    }

    // Hallway centre X derived from the "from" room
    const centerX = fromRoom.floorX + offset * fromRoom.floorWidth;

    // Gap between outer edges
    const gapY = topRoom.y + topRoom.height;
    const gapH = bottomRoom.y - gapY;

    const floor = {
      x: centerX - HALLWAY_WIDTH / 2,
      y: gapY - t,
      w: HALLWAY_WIDTH,
      h: gapH + t * 2,
    };

    const sideWalls = [
      { x: centerX - HALLWAY_WIDTH / 2 - t, y: gapY, w: t, h: gapH },
      { x: centerX + HALLWAY_WIDTH / 2,     y: gapY, w: t, h: gapH },
    ];

    // Openings cut into room walls (X-axis range)
    const openings = [
      {
        roomIndex: topIdx, side: 'bottom',
        start: centerX - HALLWAY_WIDTH / 2,
        end:   centerX + HALLWAY_WIDTH / 2,
      },
      {
        roomIndex: bottomIdx, side: 'top',
        start: centerX - HALLWAY_WIDTH / 2,
        end:   centerX + HALLWAY_WIDTH / 2,
      },
    ];

    return { floor, sideWalls, openings, floorColor: FLOOR_COLOR, wallColor: WALL_COLOR };
  }

  // ── Wall segment computation ──────────────────────────────────────

  _buildWalls() {
    const walls = [];

    // Collect all hallway openings keyed by "roomIndex_side"
    const openingsMap = new Map();
    for (const h of this.hallways) {
      for (const o of h.openings) {
        const key = `${o.roomIndex}_${o.side}`;
        if (!openingsMap.has(key)) openingsMap.set(key, []);
        openingsMap.get(key).push({ start: o.start, end: o.end });
      }
    }

    // Room walls — split where hallways connect
    for (let i = 0; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const { x, y, width: w, height: h, wallThickness: t } = room;

      const wallDefs = [
        { side: 'top',    rect: { x, y, w, h: t } },
        { side: 'bottom', rect: { x, y: y + h - t, w, h: t } },
        { side: 'left',   rect: { x, y, w: t, h } },
        { side: 'right',  rect: { x: x + w - t, y, w: t, h } },
      ];

      for (const { side, rect } of wallDefs) {
        const key = `${i}_${side}`;
        const sideOpenings = openingsMap.get(key);

        if (!sideOpenings || sideOpenings.length === 0) {
          walls.push(rect);
        } else {
          walls.push(...this._splitWall(rect, side, sideOpenings));
        }
      }
    }

    // Hallway side walls
    for (const h of this.hallways) {
      walls.push(...h.sideWalls);
    }

    return walls;
  }

  /**
   * Split a wall rectangle around one or more openings.
   *
   * Top/bottom walls run along X → openings split in X.
   * Left/right walls run along Y → openings split in Y.
   */
  _splitWall(rect, side, openings) {
    const isHorizontal = side === 'top' || side === 'bottom';
    const sorted = [...openings].sort((a, b) => a.start - b.start);
    const segments = [];

    if (isHorizontal) {
      let curX = rect.x;
      for (const o of sorted) {
        if (o.start > curX) {
          segments.push({ x: curX, y: rect.y, w: o.start - curX, h: rect.h });
        }
        curX = Math.max(curX, o.end);
      }
      const wallEnd = rect.x + rect.w;
      if (curX < wallEnd) {
        segments.push({ x: curX, y: rect.y, w: wallEnd - curX, h: rect.h });
      }
    } else {
      let curY = rect.y;
      for (const o of sorted) {
        if (o.start > curY) {
          segments.push({ x: rect.x, y: curY, w: rect.w, h: o.start - curY });
        }
        curY = Math.max(curY, o.end);
      }
      const wallEnd = rect.y + rect.h;
      if (curY < wallEnd) {
        segments.push({ x: rect.x, y: curY, w: rect.w, h: wallEnd - curY });
      }
    }

    return segments;
  }

  // ── Public API ────────────────────────────────────────────────────

  /** All collision wall segments (rooms + hallways, with openings removed). */
  getWalls() {
    return this.walls;
  }

  render(ctx) {
    // 1. Rooms (walls then floor — Room.render draws both)
    for (const room of this.rooms) {
      room.render(ctx);
    }

    // 2. Hallway floors — drawn over room walls to create visual openings
    for (const h of this.hallways) {
      ctx.fillStyle = h.floorColor;
      ctx.fillRect(h.floor.x, h.floor.y, h.floor.w, h.floor.h);
    }

    // 3. Hallway side walls
    for (const h of this.hallways) {
      ctx.fillStyle = h.wallColor;
      for (const wall of h.sideWalls) {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      }
    }
  }
}
