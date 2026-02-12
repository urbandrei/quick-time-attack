import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { Room } from '../levels/room.js';
import { Player } from '../player.js';
import { Camera } from '../camera.js';
import { ParticlePool } from '../systems/particles.js';
import { ScreenFlash } from '../systems/screenFlash.js';
import { audio } from '../systems/audio.js';
import { tutorials } from '../systems/tutorials.js';
import {
  MENU_ROOM,
  MENU_HOLE,
  MENU_PLAYER_START,
  MENU_OBJECTS,
  INTERACTION_RADIUS,
} from '../menus/mainMenu.js';

const HOLE_COLOR = '#050510';
const HOLE_BORDER_COLOR = '#44ff88';
const HOLE_BORDER_WIDTH = 3;

const FALL_DURATION = 0.4;
const LAND_DURATION = 0.35;
const SQUASH_DURATION = 0.12;
const LAND_DROP_HEIGHT = 300;

export class MainMenuScene {
  constructor(game) {
    this.game = game;
    this._initialized = false;
    this._returnFromGameplay = false;
  }

  enter() {
    // Returning from gameplay — reset player + play landing animation
    if (this._returnFromGameplay) {
      this._returnFromGameplay = false;
      this.player.x = MENU_PLAYER_START.x;
      this.player.y = MENU_PLAYER_START.y;
      this._snapCamera();
      this.nearestObject = null;
      this.transition = { phase: 'landing', timer: 0 };
      audio.playSFX('landing');
      return;
    }

    // Returning from overlay (settings, trophies, etc.) — do nothing
    if (this._initialized) return;
    this._initialized = true;

    this.room = new Room(MENU_ROOM);
    this.walls = this.room.getWalls();

    this.player = new Player({
      x: MENU_PLAYER_START.x,
      y: MENU_PLAYER_START.y,
    });

    this.camera = new Camera();
    this._snapCamera();

    this.particles = new ParticlePool(200);
    this.screenFlash = new ScreenFlash();

    this.nearestObject = null;
    this.transition = { phase: 'landing', timer: 0 };

    // Floor tutorial text (intro controls, shown once ever)
    // Positioned between the hole and the bottom menu objects
    const introLines = tutorials.getIntroLines();
    if (introLines.length > 0) {
      this.floorText = {
        lines: introLines,
        x: MENU_HOLE.x,
        y: MENU_HOLE.y + 70,
      };
    } else {
      this.floorText = null;
    }
  }

  exit() {}

  update(dt) {
    // Transition animation overrides normal input
    if (this.transition) {
      this._updateTransition(dt);
      return;
    }

    // Always-update systems
    this.particles.update(dt);
    this.screenFlash.update(dt);

    // Player movement + wall collision
    this.player.update(dt, this.walls);
    audio.setListenerPosition(this.player.x, this.player.y);
    this._updateCamera(dt);

    // Proximity check for interactable objects
    this.nearestObject = null;
    let nearestDist = Infinity;
    for (const obj of MENU_OBJECTS) {
      const dx = this.player.x - obj.x;
      const dy = this.player.y - obj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < INTERACTION_RADIUS && dist < nearestDist) {
        nearestDist = dist;
        this.nearestObject = obj;
      }
    }

    // Hole collision — start falling animation
    const hdx = this.player.x - MENU_HOLE.x;
    const hdy = this.player.y - MENU_HOLE.y;
    const holeDist = hdx * hdx + hdy * hdy;
    const holeThreshold = MENU_HOLE.radius + this.player.wallRadius;
    if (holeDist < holeThreshold * holeThreshold) {
      audio.playSFX('falling');
      this.transition = {
        phase: 'falling',
        timer: 0,
        startX: this.player.x,
        startY: this.player.y,
      };
      return;
    }

    // Interact key — open screen for nearest object
    if (this.nearestObject && input.isActionJustPressed('interact')) {
      audio.playSFX('menuSelect');
      this._openObjectScene(this.nearestObject);
    }

    // Mouse click on interactable objects
    if (input.isMouseJustPressed(0)) {
      const screenMouse = input.getMousePos();
      const world = this.camera.screenToWorld(screenMouse.x, screenMouse.y);
      for (const obj of MENU_OBJECTS) {
        const half = obj.size / 2;
        if (world.x >= obj.x - half && world.x <= obj.x + half &&
            world.y >= obj.y - half && world.y <= obj.y + half) {
          audio.playSFX('menuSelect');
          this._openObjectScene(obj);
          break;
        }
      }
    }
  }

  _updateTransition(dt) {
    this.transition.timer += dt;
    this.particles.update(dt);
    this.screenFlash.update(dt);

    switch (this.transition.phase) {
      case 'falling':
        if (this.transition.timer >= FALL_DURATION && !this.transition.done) {
          this.transition.done = true;
          import('./gameplayScene.js').then(({ GameplayScene }) => {
            this.game.pushScene(new GameplayScene(this.game, { startWithLanding: true }));
          });
        }
        break;

      case 'landing':
        if (this.transition.timer >= LAND_DURATION) {
          this.transition = { phase: 'squash', timer: 0 };
          this.camera.shake(0.6);
          this.particles.addBlastWave(this.player.x, this.player.y, 50, 0.3);
          this.particles.emit(this.player.x, this.player.y, {
            vx: 0, vy: 0, vxRandom: 120, vyRandom: 60,
            life: 0.35, lifeRandom: 0.1,
            size: 3, sizeRandom: 2, endSize: 0,
            color: '#aaaaaa', endColor: '#666666',
            friction: 0.85, gravity: 80,
          }, 10);
        }
        this.camera._updateShake(dt);
        break;

      case 'squash':
        this.camera._updateShake(dt);
        this.particles.update(dt);
        this.screenFlash.update(dt);
        if (this.transition.timer >= SQUASH_DURATION) {
          this.transition = null;
        }
        break;
    }
  }

  _openObjectScene(obj) {
    if (obj.id === 'settings') {
      import('./settingsScene.js').then(({ SettingsScene }) => {
        this.game.pushScene(new SettingsScene(this.game));
      });
    } else if (obj.id === 'achievements') {
      import('./achievementsScene.js').then(({ AchievementsScene }) => {
        this.game.pushScene(new AchievementsScene(this.game));
      });
    } else if (obj.id === 'leaderboard') {
      import('./leaderboardScene.js').then(({ LeaderboardScene }) => {
        this.game.pushScene(new LeaderboardScene(this.game));
      });
    } else {
      import('./placeholderScene.js').then(({ PlaceholderScene }) => {
        this.game.pushScene(new PlaceholderScene(this.game, { title: obj.label }));
      });
    }
  }

  render(ctx) {
    // Clear background
    ctx.fillStyle = '#0e0e1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // World-space rendering
    this.camera.applyTransform(ctx);

    // Room (walls + floor)
    this.room.render(ctx);

    // Hole
    this._renderHole(ctx);

    // Portal arrow label (always visible, above hole)
    this._renderPortalArrow(ctx);

    // Floor tutorial text
    if (this.floorText) this._renderFloorText(ctx);

    // Interactable objects
    for (const obj of MENU_OBJECTS) {
      this._renderObject(ctx, obj);
    }

    // Particles (world-space)
    this.particles.render(ctx);

    // Player (with transition animation if active)
    if (this.transition) {
      this._renderTransitionPlayer(ctx);
    } else {
      this.player.render(ctx);
    }

    this.camera.removeTransform(ctx);

    // Screen flash (screen-space overlay)
    this.screenFlash.render(ctx);

    // Screen-space UI
    this._renderUI(ctx);
  }

  _renderHole(ctx) {
    const { x, y, radius } = MENU_HOLE;

    // Dark fill
    ctx.fillStyle = HOLE_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing green border
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
    ctx.strokeStyle = HOLE_BORDER_COLOR;
    ctx.lineWidth = HOLE_BORDER_WIDTH;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _renderPortalArrow(ctx) {
    const hx = MENU_HOLE.x;
    const hy = MENU_HOLE.y;

    // Downward arrow triangle pointing at the hole
    const arrowY = hy - 46;
    const arrowSize = 8;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#44ff88';
    ctx.beginPath();
    ctx.moveTo(hx - arrowSize, arrowY);
    ctx.lineTo(hx + arrowSize, arrowY);
    ctx.lineTo(hx, arrowY + arrowSize);
    ctx.closePath();
    ctx.fill();

    // Label above arrow
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('RUN INTO PORTAL TO START', hx, arrowY - 6);
    ctx.globalAlpha = 1;
  }

  _renderFloorText(ctx) {
    const { lines, x, y } = this.floorText;
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === '') continue;
      const ly = y + i * 18;

      // Shadow
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#000000';
      ctx.fillText(lines[i], x + 1, ly + 1);

      // Text
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#8899bb';
      ctx.fillText(lines[i], x, ly);
    }

    ctx.globalAlpha = 1;
  }

  _renderObject(ctx, obj) {
    const half = obj.size / 2;

    // Colored square
    ctx.fillStyle = obj.color;
    ctx.fillRect(obj.x - half, obj.y - half, obj.size, obj.size);

    // Label above the object
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(obj.label, obj.x, obj.y - half - 8);

    // "Press E" prompt if this is the nearest object in range
    if (obj === this.nearestObject) {
      ctx.fillStyle = '#44ff88';
      ctx.font = '7px "Press Start 2P"';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Press E', obj.x, obj.y - half - 22);
    }
  }

  _renderUI(ctx) {
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('QUICK TIME ATTACK', CANVAS_WIDTH / 2, 16);
  }

  /**
   * Compute the bounded camera target from player position + mouse lead.
   * Player position maps proportionally to camera range so the camera
   * only reaches the edge when the player is at the edge, with the
   * camera lerp providing natural easing.
   */
  _getCameraTarget() {
    const halfW = CANVAS_WIDTH / 2;
    const halfH = CANVAS_HEIGHT / 2;
    const { floorX, floorY, floorWidth, floorHeight } = this.room;

    // Camera allowed range
    const camMinX = floorX + halfW;
    const camMaxX = floorX + floorWidth - halfW;
    const camMinY = floorY + halfH;
    const camMaxY = floorY + floorHeight - halfH;

    // Player position normalized within floor (0–1)
    const tx = Math.max(0, Math.min(1, (this.player.x - floorX) / floorWidth));
    const ty = Math.max(0, Math.min(1, (this.player.y - floorY) / floorHeight));

    // Map proportionally to camera range
    let targetX = camMinX + tx * (camMaxX - camMinX);
    let targetY = camMinY + ty * (camMaxY - camMinY);

    // Mouse lead offset
    const mousePos = input.getMousePos();
    const mdx = mousePos.x - halfW;
    const mdy = mousePos.y - halfH;
    const dist = Math.sqrt(mdx * mdx + mdy * mdy);
    if (dist > 1) {
      targetX += (mdx / dist) * this.camera.leadFactor;
      targetY += (mdy / dist) * this.camera.leadFactor;
    }

    // Clamp so lead can't push past bounds
    targetX = Math.max(camMinX, Math.min(camMaxX, targetX));
    targetY = Math.max(camMinY, Math.min(camMaxY, targetY));

    return { x: targetX, y: targetY };
  }

  _snapCamera() {
    const { x, y } = this._getCameraTarget();
    this.camera.snapTo(x, y);
  }

  _updateCamera(dt) {
    const { x, y } = this._getCameraTarget();

    // Lerp toward target (same speed as Camera.update)
    this.camera.x += (x - this.camera.x) * this.camera.lerpSpeed * dt;
    this.camera.y += (y - this.camera.y) * this.camera.lerpSpeed * dt;

    this.camera._updateShake(dt);
  }

  _renderTransitionPlayer(ctx) {
    const { width, height, color } = this.player;
    let drawX, drawY, scaleX, scaleY;

    switch (this.transition.phase) {
      case 'falling': {
        const t = Math.min(this.transition.timer / FALL_DURATION, 1);
        const eased = t * t;
        drawX = _lerp(this.transition.startX, MENU_HOLE.x, eased);
        drawY = _lerp(this.transition.startY, MENU_HOLE.y, eased);
        const s = 1 - eased * 0.85;
        scaleX = s;
        scaleY = s;
        break;
      }
      case 'landing': {
        const t = Math.min(this.transition.timer / LAND_DURATION, 1);
        const eased = t * t;
        drawX = this.player.x;
        drawY = this.player.y - LAND_DROP_HEIGHT * (1 - eased);
        scaleX = _lerp(0.6, 1, eased);
        scaleY = _lerp(0.6, 1, eased);
        break;
      }
      case 'squash': {
        const t = Math.min(this.transition.timer / SQUASH_DURATION, 1);
        drawX = this.player.x;
        drawY = this.player.y;
        scaleX = _lerp(1.4, 1, t);
        scaleY = _lerp(0.6, 1, t);
        break;
      }
      default:
        return;
    }

    const w = width * scaleX;
    const h = height * scaleY;
    ctx.fillStyle = color;
    ctx.fillRect(drawX - w / 2, drawY - h / 2, w, h);
  }

  onInput(event) {}
}

function _lerp(a, b, t) {
  return a + (b - a) * t;
}
