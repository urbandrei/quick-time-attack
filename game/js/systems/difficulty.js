// ── Difficulty scaling based on level depth ──────────────────────────────

// Helper: linear interpolation clamped to 0..1 over a level range
function _lerp(a, b, levelDepth, startLevel, endLevel) {
  const t = Math.min(Math.max((levelDepth - startLevel) / (endLevel - startLevel), 0), 1);
  return a + (b - a) * t;
}

/**
 * Level time limit: starts at 60s, drops 5s every 5 levels, min 30s.
 * L1-5: 60s, L6-10: 55s, L11-15: 50s, ... L31+: 30s
 */
export function getLevelTimeLimit(levelDepth) {
  return Math.max(30, 60 - Math.floor((levelDepth - 1) / 5) * 5);
}

/**
 * QTE time limit: starts at 5s, drops 1s every 5 levels, min 3s.
 * L1-5: 5s, L6-10: 4s, L11+: 3s
 */
export function getQTETimeLimit(levelDepth) {
  return Math.max(3, 5 - Math.floor((levelDepth - 1) / 5));
}

/**
 * Generator tap target: starts at 5, increases by 2 every 5 levels, max 15.
 * L1-5: 5, L6-10: 7, L11-15: 9, L16-20: 11, L21-25: 13, L26+: 15
 */
export function getGeneratorTapTarget(levelDepth) {
  return Math.min(5 + Math.floor((levelDepth - 1) / 5) * 2, 15);
}

/**
 * Bat size scale factor: 2x at level 1, linearly shrinks to 2/3x at level 20.
 * Stays at 2/3x after level 20.
 */
export function getBatSizeScale(levelDepth) {
  return _lerp(2, 2 / 3, levelDepth, 1, 20);
}

// ── Gopher QTE scaling ───────────────────────────────────────────────────

/** Whacks needed: 3 at L1 → 6 at L20 */
export function getGopherWhacks(levelDepth) {
  return Math.round(_lerp(3, 6, levelDepth, 1, 20));
}

/** How long a gopher stays up: 1.2s at L1 → 0.5s at L20 */
export function getGopherPopDuration(levelDepth) {
  return _lerp(1.2, 0.5, levelDepth, 1, 20);
}

/** Time between pops: fixed 0.4s */
export function getGopherPopInterval() {
  return 0.4;
}

/** Max total gophers that will pop: 30 at L1 → 7 at L20 */
export function getGopherMaxPops(levelDepth) {
  return Math.round(_lerp(30, 7, levelDepth, 1, 20));
}

// ── Heart QTE scaling ────────────────────────────────────────────────────

/** Number of hearts: 3 at L1, +1 every 5 levels, max 5 */
export function getHeartCount(levelDepth) {
  return Math.min(3 + Math.floor((levelDepth - 1) / 5), 5);
}

/** Heart scroll speed: 120 px/s at L1 → 280 px/s at L20 */
export function getHeartScrollSpeed(levelDepth) {
  return _lerp(120, 280, levelDepth, 1, 20);
}

// ── Challenge room scaling ───────────────────────────────────────────────

/** Challenge level duration: 20s before L10, 30s at L10+ */
export function getChallengeTimeLimit(levelDepth) {
  return levelDepth < 10 ? 20 : 30;
}

/** Challenge safe time (when hole turns green): 10s before L10, 5s at L10+ */
export function getChallengeSafeTime(levelDepth) {
  return levelDepth < 10 ? 10 : 5;
}

/** Seconds between challenge spawns: 3s at L1 → 1.2s at L25 */
export function getChallengeSpawnInterval(levelDepth) {
  return _lerp(3, 1.2, levelDepth, 1, 25);
}

/** Enemies per challenge spawn: 1 at L1 → 3 at L20 */
export function getChallengeClumpSize(levelDepth) {
  return Math.round(_lerp(1, 3, levelDepth, 1, 20));
}

// ── Boss room scaling ────────────────────────────────────────────────────

/** Seconds between boss spawns: 4s at L5 → 1.5s at L30 */
export function getBossSpawnInterval(levelDepth) {
  return _lerp(4, 1.5, levelDepth, 5, 30);
}

/** Enemies per boss spawn: 1 at L5 → 3 at L25 */
export function getBossClumpSize(levelDepth) {
  return Math.round(_lerp(1, 3, levelDepth, 5, 25));
}
