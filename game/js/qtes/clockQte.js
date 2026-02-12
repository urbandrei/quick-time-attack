import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { QTE } from './qte.js';

// ── Layout ─────────────────────────────────────────────────────────────
const CLOCK_RADIUS = 120;
const HOUR_HAND_LENGTH = 60;
const MINUTE_HAND_LENGTH = 90;
const CENTER_DOT_RADIUS = 5;

// ── Tolerance (half the angular gap between valid positions) ───────────
const HOUR_TOLERANCE = Math.PI / 12;   // ±15° (12 positions, 30° apart)
const MINUTE_TOLERANCE = Math.PI / 6;  // ±30° (4 positions, 90° apart)

export class ClockQTE extends QTE {
  constructor({ enemy = null } = {}) {
    super({ timeLimit: 3, enemy });
    this.hideEnemyLabel = true;

    // Random target time — 15-minute increments
    this.targetHour = Math.floor(Math.random() * 12);         // 0–11
    this.targetMinute = Math.floor(Math.random() * 4) * 15;   // 0, 15, 30, 45

    // Target angles (clock convention: 12 o'clock = -π/2, clockwise)
    this.targetHourAngle = (this.targetHour / 12) * Math.PI * 2 - Math.PI / 2;
    this.targetMinuteAngle = (this.targetMinute / 60) * Math.PI * 2 - Math.PI / 2;

    // Clock center on screen
    this.cx = CANVAS_WIDTH / 2;
    this.cy = CANVAS_HEIGHT / 2 + 20;

    // Two-phase state: 'hour' → 'minute'
    this.phase = 'hour';
    this.currentAngle = -Math.PI / 2; // start pointing up
    this.lockedHourAngle = null;
  }

  init() {}

  update(dt) {
    super.update(dt);
    if (this.completed) return;

    const mouse = input.getMousePos();
    this.currentAngle = Math.atan2(mouse.y - this.cy, mouse.x - this.cx);
  }

  onInput(event) {
    if (this.completed) return;
    if (event.type !== 'mousedown' || event.button !== 0) return;

    if (this.phase === 'hour') {
      this.lockedHourAngle = this.currentAngle;
      this.phase = 'minute';
    } else if (this.phase === 'minute') {
      const hourOk = this._angleDiff(this.lockedHourAngle, this.targetHourAngle) <= HOUR_TOLERANCE;
      const minuteOk = this._angleDiff(this.currentAngle, this.targetMinuteAngle) <= MINUTE_TOLERANCE;
      if (hourOk && minuteOk) {
        this.succeed();
      } else {
        this.fail();
      }
    }
  }

  /** Shortest angular distance (unsigned). */
  _angleDiff(a, b) {
    let diff = a - b;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff);
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    super.render(ctx); // timer bar

    // Target time text
    const displayHour = this.targetHour === 0 ? 12 : this.targetHour;
    const timeStr = `${displayHour}:${this.targetMinute.toString().padStart(2, '0')}`;
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SET TO ${timeStr}`, this.cx, this.cy - CLOCK_RADIUS - 40);

    // Phase instruction
    const phaseText = this.phase === 'hour' ? 'SET HOUR (CLICK)' : 'SET MINUTE (CLICK)';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(phaseText, this.cx, this.cy + CLOCK_RADIUS + 30);

    // Clock face outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, CLOCK_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Tick marks
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 3 === 0;
      const innerR = isMajor ? CLOCK_RADIUS - 15 : CLOCK_RADIUS - 10;
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = isMajor ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(
        this.cx + Math.cos(angle) * innerR,
        this.cy + Math.sin(angle) * innerR,
      );
      ctx.lineTo(
        this.cx + Math.cos(angle) * (CLOCK_RADIUS - 3),
        this.cy + Math.sin(angle) * (CLOCK_RADIUS - 3),
      );
      ctx.stroke();
    }

    // Ghost target hands (faint guide)
    this._drawHand(ctx, this.targetHourAngle, HOUR_HAND_LENGTH, 'rgba(52, 152, 219, 0.3)', 5);
    this._drawHand(ctx, this.targetMinuteAngle, MINUTE_HAND_LENGTH, 'rgba(52, 152, 219, 0.3)', 3);

    // Locked hour hand (neutral color — correctness revealed on second click)
    if (this.lockedHourAngle !== null) {
      this._drawHand(ctx, this.lockedHourAngle, HOUR_HAND_LENGTH, '#bbbbbb', 5);
    }

    // Active hand follows mouse
    if (this.phase === 'hour') {
      this._drawHand(ctx, this.currentAngle, HOUR_HAND_LENGTH, '#ffffff', 5);
    } else if (this.phase === 'minute') {
      this._drawHand(ctx, this.currentAngle, MINUTE_HAND_LENGTH, '#ffffff', 3);
    }

    // Center dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, CENTER_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawHand(ctx, angle, length, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.lineTo(
      this.cx + Math.cos(angle) * length,
      this.cy + Math.sin(angle) * length,
    );
    ctx.stroke();
  }
}
