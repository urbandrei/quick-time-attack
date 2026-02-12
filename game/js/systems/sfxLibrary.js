/**
 * SFX Library — All sound effects as synthesized functions.
 * Each SFX is a function (engine) => void that plays immediately.
 * Pitch/volume variation is applied by the AudioManager, not here.
 */

// ── Combat SFX ────────────────────────────────────────────────────────

function playerDamage(engine, pitchMult, volMult) {
  engine.playTone(100 * pitchMult, 0.1, 'square',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.35 * volMult);
  engine.playNoise(0.08,
    { attack: 0.005, decay: 0.02, sustain: 0.5, release: 0.02 },
    null, 0.25 * volMult);
}

function playerDeath(engine, pitchMult, volMult) {
  engine.playSweep(200 * pitchMult, 50 * pitchMult, 0.3, 'square',
    { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.1 },
    null, 0.35 * volMult);
  engine.playNoise(0.2,
    { attack: 0.01, decay: 0.05, sustain: 0.4, release: 0.05 },
    null, 0.25 * volMult);
}

function bulletFire(engine, pitchMult, volMult) {
  engine.playSweep(800 * pitchMult, 400 * pitchMult, 0.06, 'triangle',
    { attack: 0.005, decay: 0.02, sustain: 0.3, release: 0.01 },
    null, 0.12 * volMult);
}

function bulletWallHit(engine, pitchMult, volMult) {
  engine.playNoise(0.03,
    { attack: 0.002, decay: 0.01, sustain: 0.3, release: 0.005 },
    null, 0.08 * volMult);
}

function enemyDeath(engine, pitchMult, volMult) {
  engine.playSweep(200 * pitchMult, 600 * pitchMult, 0.08, 'square',
    { attack: 0.005, decay: 0.02, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult);
  engine.playNoise(0.05,
    { attack: 0.005, decay: 0.01, sustain: 0.3, release: 0.01 },
    null, 0.15 * volMult);
}

function enemyKnockback(engine, pitchMult, volMult) {
  engine.playTone(80 * pitchMult, 0.06, 'square',
    { attack: 0.005, decay: 0.02, sustain: 0.3, release: 0.01 },
    null, 0.2 * volMult);
}

function batLunge(engine, pitchMult, volMult) {
  engine.playNoise(0.15,
    { attack: 0.01, decay: 0.04, sustain: 0.3, release: 0.06 },
    null, 0.2 * volMult);
}

function batWindup(engine, pitchMult, volMult) {
  engine.playSweep(200 * pitchMult, 400 * pitchMult, 0.2, 'sine',
    { attack: 0.02, decay: 0.05, sustain: 0.4, release: 0.05 },
    null, 0.15 * volMult);
}

function dash(engine, pitchMult, volMult) {
  engine.playNoise(0.1,
    { attack: 0.005, decay: 0.03, sustain: 0.3, release: 0.03 },
    null, 0.2 * volMult);
  engine.playSweep(300 * pitchMult, 600 * pitchMult, 0.08, 'triangle',
    { attack: 0.005, decay: 0.02, sustain: 0.3, release: 0.02 },
    null, 0.12 * volMult);
}

function enemyAnticipation(engine, pitchMult, volMult) {
  engine.playSweep(300 * pitchMult, 500 * pitchMult, 0.15, 'sine',
    { attack: 0.02, decay: 0.04, sustain: 0.3, release: 0.04 },
    null, 0.1 * volMult);
}

// ── QTE SFX ───────────────────────────────────────────────────────────

function qteSuccess(engine, pitchMult, volMult) {
  engine.playTone(400 * pitchMult, 0.05, 'square',
    { attack: 0.005, decay: 0.01, sustain: 0.5, release: 0.01 },
    null, 0.3 * volMult);
  engine.playSweep(400 * pitchMult, 1200 * pitchMult, 0.2, 'triangle',
    { attack: 0.01, decay: 0.05, sustain: 0.3, release: 0.05 },
    null, 0.25 * volMult);
}

function qteFail(engine, pitchMult, volMult) {
  engine.playTone(100 * pitchMult, 0.08, 'square',
    { attack: 0.005, decay: 0.02, sustain: 0.5, release: 0.02 },
    null, 0.3 * volMult);
  engine.playSweep(300 * pitchMult, 80 * pitchMult, 0.25, 'sawtooth',
    { attack: 0.01, decay: 0.05, sustain: 0.4, release: 0.08 },
    null, 0.2 * volMult);
}

function qteStart(engine, pitchMult, volMult) {
  engine.playTone(880 * pitchMult, 0.1, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult);
}

function qteUrgent(engine, pitchMult, volMult) {
  engine.playTone(660 * pitchMult, 0.05, 'triangle',
    { attack: 0.005, decay: 0.01, sustain: 0.4, release: 0.01 },
    null, 0.2 * volMult);
}

function qteClick(engine, pitchMult, volMult) {
  engine.playTone(700 * pitchMult, 0.03, 'triangle',
    { attack: 0.002, decay: 0.01, sustain: 0.3, release: 0.005 },
    null, 0.18 * volMult);
}

// ── Level SFX ─────────────────────────────────────────────────────────

function holeOpen(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(440 * pitchMult, 0.1, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.2 * volMult, now);
  engine.playTone(550 * pitchMult, 0.1, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.2 * volMult, now + 0.08);
  engine.playTone(660 * pitchMult, 0.12, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.03 },
    null, 0.2 * volMult, now + 0.16);
}

function falling(engine, pitchMult, volMult) {
  engine.playNoise(0.4,
    { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.1 },
    null, 0.2 * volMult);
  engine.playSweep(400 * pitchMult, 100 * pitchMult, 0.4, 'sine',
    { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.1 },
    null, 0.15 * volMult);
}

function landing(engine, pitchMult, volMult) {
  engine.playTone(60 * pitchMult, 0.15, 'square',
    { attack: 0.005, decay: 0.04, sustain: 0.3, release: 0.05 },
    null, 0.3 * volMult);
  engine.playNoise(0.1,
    { attack: 0.005, decay: 0.03, sustain: 0.3, release: 0.03 },
    null, 0.2 * volMult);
}

function keyPickup(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(880 * pitchMult, 0.1, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult, now);
  engine.playTone(1100 * pitchMult, 0.12, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.03 },
    null, 0.25 * volMult, now + 0.1);
}

function timerWarning(engine, pitchMult, volMult) {
  engine.playTone(440 * pitchMult, 0.03, 'square',
    { attack: 0.002, decay: 0.01, sustain: 0.3, release: 0.005 },
    null, 0.2 * volMult);
}

function timerExpire(engine, pitchMult, volMult) {
  engine.playTone(220 * pitchMult, 0.3, 'sawtooth',
    { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.1 },
    null, 0.3 * volMult);
}

function lifeGain(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(523.25 * pitchMult, 0.1, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult, now);
  engine.playTone(659.26 * pitchMult, 0.1, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult, now + 0.1);
  engine.playTone(783.99 * pitchMult, 0.12, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.03 },
    null, 0.25 * volMult, now + 0.2);
}

function timeBonus(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(660 * pitchMult, 0.1, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult, now);
  engine.playTone(990 * pitchMult, 0.12, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.03 },
    null, 0.25 * volMult, now + 0.1);
}

function generatorOn(engine, pitchMult, volMult) {
  engine.playSweep(440 * pitchMult, 880 * pitchMult, 0.15, 'square',
    { attack: 0.01, decay: 0.03, sustain: 0.4, release: 0.03 },
    null, 0.25 * volMult);
}

function bossDefeat(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(261.63 * pitchMult, 0.12, 'square',
    { attack: 0.005, decay: 0.03, sustain: 0.5, release: 0.02 },
    null, 0.25 * volMult, now);
  engine.playTone(329.63 * pitchMult, 0.12, 'square',
    { attack: 0.005, decay: 0.03, sustain: 0.5, release: 0.02 },
    null, 0.25 * volMult, now + 0.12);
  engine.playTone(392.00 * pitchMult, 0.12, 'square',
    { attack: 0.005, decay: 0.03, sustain: 0.5, release: 0.02 },
    null, 0.25 * volMult, now + 0.24);
  engine.playTone(523.25 * pitchMult, 0.2, 'square',
    { attack: 0.005, decay: 0.03, sustain: 0.5, release: 0.05 },
    null, 0.3 * volMult, now + 0.36);
}

function challengeSafe(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(550 * pitchMult, 0.1, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.02 },
    null, 0.2 * volMult, now);
  engine.playTone(700 * pitchMult, 0.12, 'triangle',
    { attack: 0.005, decay: 0.03, sustain: 0.4, release: 0.03 },
    null, 0.2 * volMult, now + 0.1);
}

function fleePenalty(engine, pitchMult, volMult) {
  engine.playTone(150 * pitchMult, 0.15, 'sawtooth',
    { attack: 0.01, decay: 0.03, sustain: 0.5, release: 0.04 },
    null, 0.25 * volMult);
}

// ── UI SFX ────────────────────────────────────────────────────────────

function menuHover(engine, pitchMult, volMult) {
  engine.playTone(600 * pitchMult, 0.02, 'triangle',
    { attack: 0.002, decay: 0.005, sustain: 0.3, release: 0.005 },
    null, 0.15 * volMult);
}

function menuSelect(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(800 * pitchMult, 0.04, 'triangle',
    { attack: 0.002, decay: 0.01, sustain: 0.3, release: 0.01 },
    null, 0.2 * volMult, now);
  engine.playTone(1000 * pitchMult, 0.04, 'triangle',
    { attack: 0.002, decay: 0.01, sustain: 0.3, release: 0.01 },
    null, 0.2 * volMult, now + 0.04);
}

function menuBack(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(600 * pitchMult, 0.04, 'triangle',
    { attack: 0.002, decay: 0.01, sustain: 0.3, release: 0.01 },
    null, 0.2 * volMult, now);
  engine.playTone(400 * pitchMult, 0.04, 'triangle',
    { attack: 0.002, decay: 0.01, sustain: 0.3, release: 0.01 },
    null, 0.2 * volMult, now + 0.04);
}

function pause(engine, pitchMult, volMult) {
  engine.playNoise(0.1,
    { attack: 0.005, decay: 0.03, sustain: 0.3, release: 0.04 },
    null, 0.15 * volMult);
}

function unpause(engine, pitchMult, volMult) {
  engine.playNoise(0.1,
    { attack: 0.04, decay: 0.02, sustain: 0.2, release: 0.02 },
    null, 0.15 * volMult);
}

function achievementUnlock(engine, pitchMult, volMult) {
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  engine.playTone(523.25 * pitchMult, 0.08, 'triangle',
    { attack: 0.005, decay: 0.02, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult, now);
  engine.playTone(659.26 * pitchMult, 0.08, 'triangle',
    { attack: 0.005, decay: 0.02, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult, now + 0.08);
  engine.playTone(783.99 * pitchMult, 0.08, 'triangle',
    { attack: 0.005, decay: 0.02, sustain: 0.4, release: 0.02 },
    null, 0.25 * volMult, now + 0.16);
  engine.playTone(1046.50 * pitchMult, 0.12, 'triangle',
    { attack: 0.005, decay: 0.02, sustain: 0.4, release: 0.03 },
    null, 0.3 * volMult, now + 0.24);
}

// ── Exports ───────────────────────────────────────────────────────────

export const SFX = {
  // Combat
  playerDamage,
  playerDeath,
  bulletFire,
  bulletWallHit,
  enemyDeath,
  enemyKnockback,
  dash,
  batLunge,
  batWindup,
  enemyAnticipation,
  // QTE
  qteSuccess,
  qteFail,
  qteStart,
  qteUrgent,
  qteClick,
  // Level
  holeOpen,
  falling,
  landing,
  keyPickup,
  timerWarning,
  timerExpire,
  lifeGain,
  timeBonus,
  generatorOn,
  bossDefeat,
  challengeSafe,
  fleePenalty,
  // UI
  menuHover,
  menuSelect,
  menuBack,
  pause,
  unpause,
  achievementUnlock,
};
