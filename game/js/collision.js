// ── Collision detection & resolution ──────────────────────────────────

/**
 * Circle vs circle overlap test.
 * @param {number} ax - Circle A center X
 * @param {number} ay - Circle A center Y
 * @param {number} ar - Circle A radius
 * @param {number} bx - Circle B center X
 * @param {number} by - Circle B center Y
 * @param {number} br - Circle B radius
 * @returns {{hit:boolean, distSq:number}}  distSq is center-to-center distance squared
 */
export function checkCircleCollision(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const distSq = dx * dx + dy * dy;
  const radiiSum = ar + br;
  return { hit: distSq < radiiSum * radiiSum, distSq };
}

/**
 * Pure AABB overlap test.
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @returns {boolean}
 */
export function checkAABB(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Circle vs AABB overlap test with push vector.
 * @param {number} cx - Circle center X
 * @param {number} cy - Circle center Y
 * @param {number} r  - Circle radius
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @returns {{overlaps:boolean, pushX:number, pushY:number}}
 */
export function checkCircleVsAABB(cx, cy, r, rect) {
  // Closest point on rect to circle center
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));

  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  // Center is outside the rect
  if (distSq > 0) {
    if (distSq >= r * r) return { overlaps: false, pushX: 0, pushY: 0 };
    const dist = Math.sqrt(distSq);
    const overlap = r - dist;
    return {
      overlaps: true,
      pushX: (dx / dist) * overlap,
      pushY: (dy / dist) * overlap,
    };
  }

  // Center is inside the rect — use minimum-axis push
  const pushLeft  = (cx + r) - rect.x;
  const pushRight = (rect.x + rect.w) - (cx - r);
  const pushUp    = (cy + r) - rect.y;
  const pushDown  = (rect.y + rect.h) - (cy - r);

  const minX = pushLeft < pushRight ? -pushLeft : pushRight;
  const minY = pushUp   < pushDown  ? -pushUp   : pushDown;

  if (Math.abs(minX) < Math.abs(minY)) {
    return { overlaps: true, pushX: minX, pushY: 0 };
  }
  return { overlaps: true, pushX: 0, pushY: minY };
}

/**
 * Resolve an entity's position against wall AABBs with slide-along behavior.
 *
 * Default mode treats the entity as an AABB centered at (entity.x, entity.y).
 * Circle mode (options.useCircle + options.radius) treats it as a circle.
 *
 * @param {object} entity - Must have x, y, width, height
 * @param {{x:number,y:number,w:number,h:number}[]} walls
 * @param {{useCircle?:boolean, radius?:number}} [options]
 */
export function resolveWallCollision(entity, walls, options) {
  if (options && options.useCircle) {
    _resolveCircle(entity, walls, options.radius);
  } else {
    _resolveAABB(entity, walls);
  }
}

function _resolveAABB(entity, walls) {
  const hw = entity.width / 2;
  const hh = entity.height / 2;

  for (const wall of walls) {
    // Entity AABB (top-left corner)
    const ex = entity.x - hw;
    const ey = entity.y - hh;

    // Overlap test
    if (ex >= wall.x + wall.w || ex + entity.width <= wall.x ||
        ey >= wall.y + wall.h || ey + entity.height <= wall.y) {
      continue;
    }

    // Penetration depths on each axis
    const overlapRight  = (ex + entity.width) - wall.x;   // entity pushing into wall's left
    const overlapLeft   = (wall.x + wall.w) - ex;          // entity pushing into wall's right
    const overlapDown   = (ey + entity.height) - wall.y;   // entity pushing into wall's top
    const overlapUp     = (wall.y + wall.h) - ey;          // entity pushing into wall's bottom

    const minXOverlap = overlapRight < overlapLeft ? -overlapRight : overlapLeft;
    const minYOverlap = overlapDown  < overlapUp   ? -overlapDown  : overlapUp;

    if (Math.abs(minXOverlap) < Math.abs(minYOverlap)) {
      entity.x += minXOverlap;
    } else {
      entity.y += minYOverlap;
    }
  }
}

function _resolveCircle(entity, walls, radius) {
  for (const wall of walls) {
    const result = checkCircleVsAABB(entity.x, entity.y, radius, wall);
    if (result.overlaps) {
      entity.x += result.pushX;
      entity.y += result.pushY;
    }
  }
}

/**
 * Returns all wall segments from a level. Thin wrapper for API consistency.
 * @param {import('./levels/level.js').Level} level
 * @returns {{x:number,y:number,w:number,h:number}[]}
 */
export function getWallSegments(level) {
  return level.getWalls();
}
