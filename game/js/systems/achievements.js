import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';

const STORAGE_KEY = 'qta_achievements';

const NOTIFICATION_DURATION = 3;   // seconds
const FADE_TIME = 0.3;             // seconds fade in/out

const BADGE_W = 250;
const BADGE_H = 52;
const BADGE_MARGIN = 12;
const BADGE_GAP = 6;
const BADGE_RADIUS = 4;

export const ACHIEVEMENTS = [
  { id: 'noob',          name: 'NOOB',             description: 'Play your first game' },
  { id: 'exterminator',  name: 'EXTERMINATOR',      description: 'Kill all enemies 5 floors in a row' },
  { id: 'pacifist',      name: 'PACIFIST',          description: 'No kills for 5 floors in a row' },
  { id: 'promoted',      name: 'PROMOTED',          description: 'Defeat a boss' },
  { id: 'skilled',       name: 'SKILLED',           description: 'Reach floor 20' },
  { id: 'offTheClock',   name: 'OFF THE CLOCK',     description: 'Take a coffee break' },
  { id: 'kingOfTheHill', name: 'KING OF THE HILL',  description: 'Top the leaderboard' },
];

class AchievementManager {
  constructor() {
    this.unlocked = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    this.notifications = [];

    // Per-run streak tracking
    this.exterminatorStreak = 0;
    this.pacifistStreak = 0;
  }

  /** Reset per-run tracking state. Called at the start of each new run. */
  resetRunState() {
    this.exterminatorStreak = 0;
    this.pacifistStreak = 0;
  }

  /**
   * Unlock an achievement by ID. No-op if already unlocked.
   * Queues a notification badge on first unlock.
   */
  unlock(id) {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    this._save();

    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (achievement) {
      this.notifications.push({
        achievement,
        timer: 0,
        duration: NOTIFICATION_DURATION,
      });
    }
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  /** Return all achievements with their unlock status. */
  getAll() {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: this.unlocked.has(a.id),
    }));
  }

  // ── Event hooks ──────────────────────────────────────────────────────

  /** Called when gameplay starts (enter GameplayScene for the first time in a run). */
  onGameStart() {
    this.unlock('noob');
    this.resetRunState();
  }

  /** Called when a coffee break level is entered. */
  onCoffeeBreak() {
    this.unlock('offTheClock');
  }

  /** Called when boss HP reaches 0. */
  onBossDefeated() {
    this.unlock('promoted');
  }

  /**
   * Called when the player enters the exit hole (level complete).
   * @param {object} info
   * @param {string} info.challengeType — CHALLENGE_TYPES value
   * @param {boolean} info.allEnemiesKilled — true if no active enemies remain
   * @param {number} info.enemiesKilledThisFloor — kills on this floor
   * @param {number} info.levelDepth — current floor number
   */
  onLevelComplete({ challengeType, allEnemiesKilled, enemiesKilledThisFloor, levelDepth }) {
    // Skilled: reach floor 20
    if (levelDepth >= 20) {
      this.unlock('skilled');
    }

    // Skip boss and coffee break for streak tracking
    if (challengeType === 'BOSS' || challengeType === 'COFFEE_BREAK') return;

    // Exterminator: kill all enemies 5 floors in a row
    if (allEnemiesKilled) {
      this.exterminatorStreak++;
      if (this.exterminatorStreak >= 5) this.unlock('exterminator');
    } else {
      this.exterminatorStreak = 0;
    }

    // Pacifist: no kills for 5 floors in a row
    if (enemiesKilledThisFloor === 0) {
      this.pacifistStreak++;
      if (this.pacifistStreak >= 5) this.unlock('pacifist');
    } else {
      this.pacifistStreak = 0;
    }
  }

  /**
   * Called after a run is submitted to localStorage.
   * @param {Array} runs — full array of saved runs
   * @param {object} latestRun — the just-submitted run
   */
  onRunSubmitted(runs, latestRun) {
    if (runs.length === 0) return;
    // Check if this run ties or beats the best
    const best = runs.reduce((a, b) => (b.levelDepth > a.levelDepth ? b : a));
    if (latestRun.levelDepth >= best.levelDepth) {
      this.unlock('kingOfTheHill');
    }
  }

  // ── Update & render (called from main game loop) ────────────────────

  update(dt) {
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].timer += dt;
      if (this.notifications[i].timer >= this.notifications[i].duration) {
        this.notifications.splice(i, 1);
      }
    }
  }

  render(ctx) {
    for (let i = 0; i < this.notifications.length; i++) {
      this._renderNotification(ctx, this.notifications[i], i);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────

  _renderNotification(ctx, notif, index) {
    const { achievement, timer, duration } = notif;

    const x = CANVAS_WIDTH - BADGE_W - BADGE_MARGIN;
    const y = CANVAS_HEIGHT - (BADGE_H + BADGE_GAP) * (index + 1) - BADGE_MARGIN + BADGE_GAP;

    // Fade in / out
    let alpha = 1;
    if (timer < FADE_TIME) {
      alpha = timer / FADE_TIME;
    } else if (timer > duration - FADE_TIME) {
      alpha = (duration - timer) / FADE_TIME;
    }
    ctx.globalAlpha = Math.max(0, alpha);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    _roundRect(ctx, x, y, BADGE_W, BADGE_H, BADGE_RADIUS);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#44ff88';
    ctx.lineWidth = 2;
    _roundRect(ctx, x, y, BADGE_W, BADGE_H, BADGE_RADIUS);
    ctx.stroke();

    // Header
    ctx.fillStyle = '#44ff88';
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ACHIEVEMENT UNLOCKED', x + 10, y + 8);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(achievement.name, x + 10, y + 22);

    // Description
    ctx.fillStyle = '#888888';
    ctx.font = '6px "Press Start 2P"';
    ctx.fillText(achievement.description, x + 10, y + 38);

    ctx.globalAlpha = 1;
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked]));
  }
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export const achievements = new AchievementManager();
