import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { PauseScene } from './pauseScene.js';
import { GameOverScene } from './gameOverScene.js';
import { QTEScene } from './qteScene.js';
import { Level } from '../levels/level.js';
import { LevelManager, CHALLENGE_TYPES } from '../levels/levelManager.js';
import { getWallSegments, checkCircleCollision, checkAABB } from '../collision.js';
import { Player } from '../player.js';
import { Camera } from '../camera.js';
import { BulletPool } from '../bullet.js';
import { HUD } from '../hud.js';
import { spawnEnemies, spawnChallengeEnemy } from '../levels/enemySpawner.js';
import { achievements } from '../systems/achievements.js';
import { HitstopManager } from '../systems/hitstop.js';
import { ScreenFlash } from '../systems/screenFlash.js';
import { ParticlePool, emitDeathBurst, emitWallDust, emitCorpseLinger } from '../systems/particles.js';
import { Vignette } from '../systems/vignette.js';
import { audio } from '../systems/audio.js';
import { tutorials } from '../systems/tutorials.js';
import { crt } from '../systems/crt.js';
import {
  getLevelTimeLimit, getChallengeTimeLimit, getChallengeSafeTime,
  getChallengeSpawnInterval, getChallengeClumpSize,
  getBossSpawnInterval, getBossClumpSize,
} from '../systems/difficulty.js';

// Number of frames within which a bullet hit is nullified by a QTE trigger
const QTE_PRIORITY_FRAMES = 3;

// QTE blast constants
const BLAST_RADIUS = 240;          // half room width
const KNOCKBACK_FORCE = 400;       // px/s initial impulse
const RETREAT_KNOCKBACK_FORCE = 300; // enemy retreat force on QTE failure

// Level timer (base value — overridden by difficulty scaling)
const LEVEL_TIME_LIMIT = 30; // seconds (fallback)

// Exit hole
const EXIT_HOLE_RADIUS = 24;
const EXIT_HOLE_COLOR = '#050510';
const EXIT_HOLE_BORDER_COLOR = '#44ff88';
const EXIT_HOLE_FLEE_COLOR = '#ff4444';
const EXIT_HOLE_BORDER_WIDTH = 3;

// Challenge room
const CHALLENGE_SPAWN_INTERVAL = 3;   // seconds between enemy spawns
const CHALLENGE_SAFE_TIME = 5;        // last N seconds the hole turns green

// Boss
const BOSS_MAX_HP = 5;
const BOSS_SPAWN_INTERVAL = 4;        // seconds between enemy spawns

// Key follow / homing
const KEY_FOLLOW_SPEED = 3;         // lerp factor while trailing player
const KEY_HOMING_ACCEL = 1200;      // px/s² acceleration toward hole
const KEY_ARRIVAL_DIST = 4;         // px — close enough to count as arrived

// Transition animation
const FALL_DURATION = 0.4;     // seconds — player shrinks downward into hole
const SPLASH_DURATION = 1.5;   // seconds — challenge splash screen
const LAND_DURATION = 0.35;    // seconds — player drops from above
const SQUASH_DURATION = 0.12;  // seconds — impact squash recovery
const LAND_DROP_HEIGHT = 300;  // pixels above landing point

class GameplayScene {
  constructor(game, { startWithLanding = false } = {}) {
    this.game = game;
    this._startWithLanding = startWithLanding;
  }

  enter() {
    // Guard against re-init when returning from overlay (pause, QTE, game over)
    if (this._initialized) return;
    this._initialized = true;

    this.levelManager = new LevelManager();
    this.challengeDisplayName = '';
    this.hud = new HUD();
    this.hitstop = new HitstopManager();
    this.screenFlash = new ScreenFlash();
    this.vignette = new Vignette();
    this.particles = new ParticlePool();
    this.transition = null;
    this.enemiesKilled = 0;
    this.enemiesKilledThisFloor = 0;
    this.runStartTime = performance.now();

    achievements.onGameStart();

    this._initLevel();

    // Start with splash + landing animation when entering from main menu
    if (this._startWithLanding) {
      this.transition = { phase: 'splash', timer: 0 };
      this._startWithLanding = false;
      this._playSplashVoiceline();
    }
  }

  exit() {}

  /**
   * Build (or rebuild) the current level: layout, enemies, timer, exit state.
   * Preserves player lives and levelDepth across levels.
   */
  _initLevel() {
    // Reset per-floor kill counter
    this.enemiesKilledThisFloor = 0;

    // Advance to next level and get layout + challenge info
    const levelInfo = this.levelManager.advance();
    this.challengeDisplayName = levelInfo.displayName;
    this.level = new Level(levelInfo.layout);
    this.walls = getWallSegments(this.level);

    // Create or reposition the player
    if (!this.player) {
      this.player = new Player({
        x: this.level.playerStartX,
        y: this.level.playerStartY,
      });
    } else {
      this.player.x = this.level.playerStartX;
      this.player.y = this.level.playerStartY;
    }

    // Camera — snap to player immediately so there's no lerp-from-origin
    this.camera = new Camera();
    this.camera.snapTo(this.player.x, this.player.y);

    // Bullet pool
    this.bullets = new BulletPool();

    // QTE priority tracking
    this.frameCount = 0;
    this.bulletDamageFrame = -Infinity;
    this.qteActive = false;

    // Level timer (scaled by difficulty)
    this.levelTimer = getLevelTimeLimit(this.levelManager.levelDepth);
    this.levelTimeTotal = this.levelTimer;

    // Challenge completion & exit hole
    this.challengeComplete = false;
    this.exitHole = null;
    this.gameOverPushed = false;

    // Key item (Find the Key challenge)
    this.keyItem = null;
    this.hasKey = false;
    if (levelInfo.challengeType === CHALLENGE_TYPES.FIND_THE_KEY && levelInfo.keyRoomIndex != null) {
      const keyRoom = this.level.rooms[levelInfo.keyRoomIndex];
      this.keyItem = {
        x: keyRoom.floorX + keyRoom.floorWidth / 2,
        y: keyRoom.floorY + keyRoom.floorHeight / 2,
        radius: 10,
        collected: false,
        homing: false,
        homingSpeed: 0,
      };
    }

    // Timer warning tracking
    this._lastTimerWarnSec = Infinity;

    // Coffee Break — exit open immediately, no timer
    if (levelInfo.challengeType === CHALLENGE_TYPES.COFFEE_BREAK) {
      this.challengeComplete = true;
      this.exitHole = {
        x: this.level.exitHoleX,
        y: this.level.exitHoleY,
        radius: EXIT_HOLE_RADIUS,
      };
      this.timerActive = false;
      achievements.onCoffeeBreak();
    } else {
      this.timerActive = true;
    }

    // Boss — continuous spawning, 5 QTEs to win
    this.bossHP = 0;
    this.bossMaxHP = 0;
    this.bossSpawnTimer = 0;
    if (levelInfo.challengeType === CHALLENGE_TYPES.BOSS) {
      this.bossHP = BOSS_MAX_HP;
      this.bossMaxHP = BOSS_MAX_HP;
      this.bossSpawnTimer = BOSS_SPAWN_INTERVAL; // spawn first enemy immediately
    }

    // Challenge room — hole open from start (red = flee), trickle-spawn enemies
    this.challengeFleeMode = false;
    this.challengeSpawnTimer = 0;
    this.challengeSafeTime = CHALLENGE_SAFE_TIME;
    if (levelInfo.challengeType === CHALLENGE_TYPES.CHALLENGE) {
      this.levelTimer = getChallengeTimeLimit(this.levelManager.levelDepth);
      this.levelTimeTotal = this.levelTimer;
      this.challengeSafeTime = getChallengeSafeTime(this.levelManager.levelDepth);
      this.challengeFleeMode = true;
      this.challengeComplete = true; // hole exists from start
      this.exitHole = {
        x: this.level.exitHoleX,
        y: this.level.exitHoleY,
        radius: EXIT_HOLE_RADIUS,
      };
    }

    // Power Up — generators in each cardinal room
    this.generators = [];
    if (levelInfo.challengeType === CHALLENGE_TYPES.POWER_UP) {
      for (let i = 0; i < this.level.rooms.length; i++) {
        if (i === this.level.startRoomIndex) continue;
        const room = this.level.rooms[i];
        this.generators.push({
          roomIndex: i,
          x: room.floorX + room.floorWidth / 2,
          y: room.floorY + room.floorHeight / 2,
          radius: 16,
          completed: false,
        });
      }
    }

    // Spawn enemies dynamically (skip for coffee break / challenge / boss)
    const skipSpawn = levelInfo.challengeType === CHALLENGE_TYPES.COFFEE_BREAK
                   || levelInfo.challengeType === CHALLENGE_TYPES.CHALLENGE
                   || levelInfo.challengeType === CHALLENGE_TYPES.BOSS;
    if (skipSpawn) {
      this.enemies = [];
    } else {
      this.enemies = spawnEnemies(this.level, this.levelManager.levelDepth, {
        playerStart: { x: this.level.playerStartX, y: this.level.playerStartY },
        keyPosition: this.keyItem ? { x: this.keyItem.x, y: this.keyItem.y } : null,
        generators: this.generators,
      });
    }

    // Permanence marks (cleared each level)
    this.wallMarks = [];
    this.corpseMarks = [];

    // Ambient particles
    this._ambientTimer = 0;
    this._ambientInterval = 0.5 + Math.random() * 0.5;

    // Floor tutorial text
    const tutorialLines = tutorials.getLines(this.levelManager.challengeType);
    if (tutorialLines.length > 0) {
      this.tutorialType = this.levelManager.challengeType;
      if (this.levelManager.challengeType === CHALLENGE_TYPES.CHALLENGE) {
        // Position below the hole for challenge rooms
        this.floorText = {
          lines: tutorialLines,
          x: this.level.exitHoleX,
          y: this.level.exitHoleY + 55,
        };
      } else {
        const startRoom = this.level.rooms[this.level.startRoomIndex];
        this.floorText = {
          lines: tutorialLines,
          x: startRoom.floorX + startRoom.floorWidth / 2,
          y: this.level.playerStartY + 50,
        };
      }
    } else {
      this.floorText = null;
      this.tutorialType = null;
    }
  }

  /**
   * Start the falling transition into the exit hole.
   */
  _startTransition() {
    // Fire achievement checks before transitioning
    achievements.onLevelComplete({
      challengeType: this.levelManager.challengeType,
      allEnemiesKilled: this.enemies.every(e => !e.active),
      enemiesKilledThisFloor: this.enemiesKilledThisFloor,
      levelDepth: this.levelManager.levelDepth,
    });

    audio.playSFX('falling');
    audio.stopElevatorMusic();
    audio.resetLevelMusic();

    this.transition = {
      phase: 'falling',
      timer: 0,
      startX: this.player.x,
      startY: this.player.y,
      holeX: this.exitHole.x,
      holeY: this.exitHole.y,
    };
  }

  _playSplashVoiceline() {
    const map = {
      BOSS: 'bossfightincoming',
      CHALLENGE: 'challengeroom',
      FIND_THE_KEY: 'findthekey',
      POWER_UP: 'generators',
      KILL_ALL: 'killthemall',
    };
    const name = map[this.levelManager.challengeType];
    if (name) audio.playVoiceline(name);
  }

  update(dt) {
    // ── Always-update systems (even during hitstop and transitions) ──
    this.screenFlash.update(dt);
    this.vignette.update(dt, {
      lives: this.player ? this.player.lives : 3,
      isQTEActive: this.qteActive,
    });
    this.particles.update(dt);

    // Fade permanence marks
    if (this.wallMarks) {
      for (let i = this.wallMarks.length - 1; i >= 0; i--) {
        this.wallMarks[i].alpha -= dt / 5;
        if (this.wallMarks[i].alpha <= 0) this.wallMarks.splice(i, 1);
      }
    }
    if (this.corpseMarks) {
      for (let i = this.corpseMarks.length - 1; i >= 0; i--) {
        this.corpseMarks[i].alpha -= dt / 15;
        if (this.corpseMarks[i].alpha <= 0) this.corpseMarks.splice(i, 1);
      }
    }

    // Ambient particles (skip during transitions)
    if (!this.transition && this.player) {
      this._ambientTimer += dt;
      if (this._ambientTimer >= this._ambientInterval) {
        this._ambientTimer -= this._ambientInterval;
        this._ambientInterval = 0.5 + Math.random() * 0.5;
        const ax = this.player.x + (Math.random() - 0.5) * 600;
        const ay = this.player.y + (Math.random() - 0.5) * 600;
        this.particles.emit(ax, ay, {
          vxRandom: 15, vyRandom: 10,
          life: 4, lifeRandom: 1,
          size: 1.5, sizeRandom: 0.5, endSize: 0,
          color: '#555566', endColor: '#333344',
          friction: 0.99, gravity: 0,
        }, 1);
      }
    }

    // Update audio listener to player position
    if (this.player) {
      audio.setListenerPosition(this.player.x, this.player.y);
    }

    // ── Transition animation (overrides normal gameplay) ───────────────
    if (this.transition) {
      this._updateTransition(dt);
      return;
    }

    if (input.isActionJustPressed('pause')) {
      audio.playSFX('pause');
      this.game.pushScene(new PauseScene(this.game));
      return;
    }

    this.frameCount++;

    // ── Hitstop: skip entity updates while frozen ──
    const frozen = this.hitstop.update(dt);
    if (frozen) return;

    // ── Level timer countdown (paused during QTE, disabled for coffee break) ──
    if (!this.qteActive && this.timerActive) {
      this.levelTimer -= dt;
      if (this.levelTimer <= 0) {
        this.levelTimer = 0;
        if (!this.gameOverPushed) {
          audio.playSFX('timerExpire');
          audio.playExplosion();
          audio.stopGameplayMusic();
          this.player.dead = true;
          this.gameOverPushed = true;
          this.game.pushScene(new GameOverScene(this.game, {
            levelDepth: this.levelManager.levelDepth,
            enemiesKilled: this.enemiesKilled,
            runLength: (performance.now() - this.runStartTime) / 1000,
          }));
        }
        return;
      }

      // Timer warning — tick every second when < 10s
      if (this.levelTimer <= 10) {
        const sec = Math.ceil(this.levelTimer);
        if (sec !== this._lastTimerWarnSec) {
          this._lastTimerWarnSec = sec;
          audio.playSFX('timerWarning');
        }
      }
    }

    // Update gameplay music progress (shepard volumes + warning beep)
    if (this.timerActive) {
      audio.setLevelProgress(this.levelTimer, this.levelTimeTotal);
    }

    this.player.update(dt, this.walls);

    // ── Dash juice ──
    if (this.player._dashJustStarted) {
      audio.playSFX('dash');
      this.camera.shake(0.15);
      const bddx = this.player.dashDirX;
      const bddy = this.player.dashDirY;
      const bperpX = -bddy;
      const bperpY = bddx;
      const burstX = this.player.x - bddx * 16;
      const burstY = this.player.y - bddy * 16;
      // V-shaped wake burst — left side
      this.particles.emit(burstX, burstY, {
        vx: bperpX * 180 - bddx * 100,
        vy: bperpY * 180 - bddy * 100,
        vxRandom: 50, vyRandom: 50,
        life: 0.3, lifeRandom: 0.12,
        size: 5, sizeRandom: 3, endSize: 0,
        color: '#00ffff', endColor: '#004466',
        friction: 0.88, gravity: 0,
      }, 8);
      // V-shaped wake burst — right side
      this.particles.emit(burstX, burstY, {
        vx: -bperpX * 180 - bddx * 100,
        vy: -bperpY * 180 - bddy * 100,
        vxRandom: 50, vyRandom: 50,
        life: 0.3, lifeRandom: 0.12,
        size: 5, sizeRandom: 3, endSize: 0,
        color: '#00ffff', endColor: '#004466',
        friction: 0.88, gravity: 0,
      }, 8);
      // Center backward burst
      this.particles.emit(burstX, burstY, {
        vx: -bddx * 120, vy: -bddy * 120,
        vxRandom: 40, vyRandom: 40,
        life: 0.2, lifeRandom: 0.1,
        size: 3, sizeRandom: 2, endSize: 0,
        color: '#88eeff', endColor: '#002233',
        friction: 0.9, gravity: 0,
      }, 6);
      this.player._dashJustStarted = false;
    }
    if (this.player.dashing) {
      // Boat-wake: particles pushed out perpendicular to dash direction
      const ddx = this.player.dashDirX;
      const ddy = this.player.dashDirY;
      // Perpendicular vectors (two sides of the wake)
      const perpX = -ddy;
      const perpY = ddx;
      const wakeSpeed = 120;
      const backDrift = 40; // slight backward drift

      // Left wake
      this.particles.emit(this.player.x, this.player.y, {
        vx: perpX * wakeSpeed - ddx * backDrift,
        vy: perpY * wakeSpeed - ddy * backDrift,
        vxRandom: 25, vyRandom: 25,
        life: 0.25, lifeRandom: 0.1,
        size: 4, sizeRandom: 2, endSize: 0,
        color: '#00ffff', endColor: '#002233',
        friction: 0.88, gravity: 0,
      }, 3);
      // Right wake
      this.particles.emit(this.player.x, this.player.y, {
        vx: -perpX * wakeSpeed - ddx * backDrift,
        vy: -perpY * wakeSpeed - ddy * backDrift,
        vxRandom: 25, vyRandom: 25,
        life: 0.25, lifeRandom: 0.1,
        size: 4, sizeRandom: 2, endSize: 0,
        color: '#00ffff', endColor: '#002233',
        friction: 0.88, gravity: 0,
      }, 3);
      // Small center sparkles
      this.particles.emit(this.player.x, this.player.y, {
        vx: -ddx * 20, vy: -ddy * 20,
        vxRandom: 15, vyRandom: 15,
        life: 0.1, lifeRandom: 0.05,
        size: 2, sizeRandom: 1, endSize: 0,
        color: '#ffffff', endColor: '#00aacc',
        friction: 0.8, gravity: 0,
      }, 2);
    }

    this.bullets.update(dt, this.walls);

    // Emit wall dust for bullet-wall collisions + spawn wall marks
    for (const hit of this.bullets.wallHits) {
      emitWallDust(this.particles, hit.x, hit.y, hit.nx, hit.ny);
      this.wallMarks.push({
        x: hit.x, y: hit.y,
        radius: 3 + Math.random() * 2,
        alpha: 0.5,
      });
    }

    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(dt, this.walls, this.player, this.bullets);
    }

    // ── Enemy landing effects (falling animation complete) ────────────
    // Note: justLanded is cleared AFTER the QTE check below so that
    // canTriggerQTE returns false on the landing frame.
    for (const enemy of this.enemies) {
      if (!enemy.justLanded) continue;

      // VFX — lighter than player landing (multiple can land at once)
      this.camera.shake(0.3);
      this.camera.zoomPunch(0.05);
      this.particles.addBlastWave(enemy.x, enemy.y, 30, 0.2);
      this.particles.emit(enemy.x, enemy.y, {
        vx: 0, vy: 0, vxRandom: 80, vyRandom: 40,
        life: 0.25, lifeRandom: 0.1,
        size: 2, sizeRandom: 1.5, endSize: 0,
        color: '#aaaaaa', endColor: '#666666',
        friction: 0.85, gravity: 80,
      }, 6);

      audio.playSFX('landing');
      audio.playExplosion();
      enemy.squash(0.3, 0.15);

      // Damage check — player overlaps landing spot
      if (!this.player.dead && !this.player.invulnerable) {
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < enemy.width / 2 + this.player.wallRadius) {
          if (this.player.damage()) {
            this.hitstop.freeze(5);
            this.screenFlash.flash('#ff0000', 0.08);
            this.camera.shake(0.4);
            this.camera.zoomPunch(0.05);
            this.player.squash(0.3, 0.15);
            audio.playSFX('playerDamage');
          }
        }
      }
    }

    // ── Player-enemy QTE collision (AABB vs AABB, checked FIRST) ──────
    // QTE takes priority over bullet damage within a 3-frame window.
    if (!this.player.dead && (!this.player.invulnerable || this.player.dashing) && !this.qteActive) {
      const qteEnemy = this._checkQTECollision();

      if (qteEnemy) {
        // Nullify recent bullet damage if within the priority window
        if (this.frameCount - this.bulletDamageFrame <= QTE_PRIORITY_FRAMES) {
          this.player.undoDamage();
        }

        this._triggerQTE(qteEnemy);
        return; // skip bullet checks this frame
      }
    }

    // ── Clear justLanded now that QTE check has passed ─────────────
    for (const enemy of this.enemies) {
      enemy.justLanded = false;
    }

    // ── Player-generator collision (Power Up) ───────────────────────
    if (!this.player.dead && !this.qteActive && this.generators.length > 0) {
      for (const gen of this.generators) {
        if (gen.completed) continue;
        const dx = this.player.x - gen.x;
        const dy = this.player.y - gen.y;
        if (dx * dx + dy * dy < (this.player.wallRadius + gen.radius) ** 2) {
          this._triggerGeneratorQTE(gen);
          return;
        }
      }
    }

    // ── Bullet-player collision (circle vs circle) ────────────────────
    if (!this.player.dead && !this.player.invulnerable) {
      for (let i = 0; i < this.bullets.pool.length; i++) {
        const b = this.bullets.pool[i];
        if (!b.active) continue;

        const result = checkCircleCollision(
          b.x, b.y, b.radius,
          this.player.x, this.player.y, this.player.bulletRadius
        );

        if (result.hit) {
          b.active = false;
          if (this.player.damage()) {
            this.bulletDamageFrame = this.frameCount;
            this.hitstop.freeze(5);
            this.screenFlash.flash('#ff0000', 0.08);
            this.camera.shake(0.4);
            this.camera.zoomPunch(0.05);
            this.player.squash(0.3, 0.15);
            audio.playSFX('playerDamage');
          }
        }
      }
    }

    // ── Lunging bat vs player (bat acts as projectile during lunge) ───
    if (!this.player.dead && !this.player.invulnerable) {
      for (const enemy of this.enemies) {
        if (!enemy.active || !enemy.isLunging || enemy.falling) continue;

        const result = checkCircleCollision(
          enemy.x, enemy.y, enemy.lungeRadius,
          this.player.x, this.player.y, this.player.bulletRadius
        );

        if (result.hit) {
          if (this.player.damage()) {
            this.hitstop.freeze(5);
            this.screenFlash.flash('#ff0000', 0.08);
            this.camera.shake(0.4);
            this.camera.zoomPunch(0.05);
            this.player.squash(0.3, 0.15);
            audio.playSFX('playerDamage');
          }
          break; // only one damage per frame
        }
      }
    }

    this.camera.update(dt, this.player, input.getMousePos());

    // ── Challenge room: trickle-spawn enemies + flee→safe transition ──
    if (this.challengeFleeMode || this.levelManager.challengeType === CHALLENGE_TYPES.CHALLENGE) {
      // Spawn enemies at a rate that scales with level depth
      if (this.challengeFleeMode) {
        const interval = getChallengeSpawnInterval(this.levelManager.levelDepth);
        const clump = getChallengeClumpSize(this.levelManager.levelDepth);
        this.challengeSpawnTimer += dt;
        if (this.challengeSpawnTimer >= interval) {
          this.challengeSpawnTimer -= interval;
          for (let i = 0; i < clump; i++) {
            this._spawnChallengeEnemy();
          }
        }
      }

      // Transition from flee (red) to safe (green) in last N seconds
      if (this.challengeFleeMode && this.levelTimer <= this.challengeSafeTime) {
        this.challengeFleeMode = false;
        // Juice: hole turns green
        const hx = this.exitHole.x;
        const hy = this.exitHole.y;
        this.camera.shake(0.35);
        this.screenFlash.flash('#44ff88', 0.1);
        this.particles.addBlastWave(hx, hy, 60, 0.3, '#44ff88');
        this.particles.emit(hx, hy, {
          vx: 0, vy: 0, vxRandom: 140, vyRandom: 140,
          life: 0.4, lifeRandom: 0.15,
          size: 4, sizeRandom: 2, endSize: 0,
          color: '#44ff88', endColor: '#ffffff',
          friction: 0.9, gravity: 40,
        }, 12);
        audio.playSFX('challengeSafe', hx, hy);
        audio.playAnnouncement();
      }
    }

    // ── Boss: continuous enemy spawning (scales with level depth) ──────
    if (this.levelManager.challengeType === CHALLENGE_TYPES.BOSS && this.bossHP > 0) {
      const bossInterval = getBossSpawnInterval(this.levelManager.levelDepth);
      const bossClump = getBossClumpSize(this.levelManager.levelDepth);
      this.bossSpawnTimer += dt;
      if (this.bossSpawnTimer >= bossInterval) {
        this.bossSpawnTimer -= bossInterval;
        for (let i = 0; i < bossClump; i++) {
          this._spawnChallengeEnemy();
        }
      }
    }

    // ── Challenge completion check ────────────────────────────────────
    if (!this.challengeComplete) {
      const type = this.levelManager.challengeType;

      if (type === CHALLENGE_TYPES.FIND_THE_KEY) {
        // Pick up key
        if (this.keyItem && !this.keyItem.collected) {
          const dx = this.player.x - this.keyItem.x;
          const dy = this.player.y - this.keyItem.y;
          if (dx * dx + dy * dy < (this.player.wallRadius + this.keyItem.radius) ** 2) {
            this.keyItem.collected = true;
            this.hasKey = true;
            audio.playSFX('keyPickup');
            audio.playVoiceline('key');
          }
        }
        // Player enters starting room with key → key starts homing to hole
        if (this.hasKey && this.keyItem && !this.keyItem.homing
            && this._isPlayerInRoom(this.level.startRoomIndex)) {
          this.keyItem.homing = true;
          this.keyItem.homingSpeed = 0;
        }
      } else if (type !== CHALLENGE_TYPES.BOSS && type !== CHALLENGE_TYPES.POWER_UP) {
        // Default: kill all enemies (boss/power-up completion handled via QTE callbacks)
        if (this.enemies.every(e => !e.active)) {
          this.challengeComplete = true;
          const hx = this.level.exitHoleX;
          const hy = this.level.exitHoleY;
          this.exitHole = { x: hx, y: hy, radius: EXIT_HOLE_RADIUS };
          // Juice: hole opens
          this.camera.shake(0.4);
          this.screenFlash.flash('#44ff88', 0.12);
          this.particles.addBlastWave(hx, hy, 70, 0.35, '#44ff88');
          this.particles.emit(hx, hy, {
            vx: 0, vy: 0, vxRandom: 160, vyRandom: 160,
            life: 0.5, lifeRandom: 0.2,
            size: 5, sizeRandom: 3, endSize: 0,
            color: '#44ff88', endColor: '#ffffff',
            friction: 0.9, gravity: 50,
          }, 15);
          audio.playSFX('holeOpen', hx, hy);
          audio.playAnnouncement();
        }
      }
    }

    // ── Player-exit hole collision ────────────────────────────────────
    if (this.exitHole && !this.player.dead) {
      const dx = this.player.x - this.exitHole.x;
      const dy = this.player.y - this.exitHole.y;
      const distSq = dx * dx + dy * dy;
      const threshold = this.exitHole.radius + this.player.wallRadius;
      if (distSq < threshold * threshold) {
        // Fleeing a challenge room costs a life
        if (this.challengeFleeMode) {
          this.player.damage();
          audio.playSFX('fleePenalty');
        }
        this._startTransition();
        return;
      }
    }

    // Update key follow / homing
    if (this.keyItem && this.keyItem.collected) {
      if (this.keyItem.homing) {
        // Accelerate toward exit hole position
        const tx = this.level.exitHoleX;
        const ty = this.level.exitHoleY;
        const dx = tx - this.keyItem.x;
        const dy = ty - this.keyItem.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < KEY_ARRIVAL_DIST) {
          // Key arrived — open the hole, remove key
          const hx = this.level.exitHoleX;
          const hy = this.level.exitHoleY;
          this.challengeComplete = true;
          this.exitHole = { x: hx, y: hy, radius: EXIT_HOLE_RADIUS };
          this.keyItem = null;

          // Juice: shake + flash + particles + blast wave
          this.camera.shake(0.5);
          this.screenFlash.flash('#44ff88', 0.15);
          this.particles.addBlastWave(hx, hy, 80, 0.4, '#44ff88');
          this.particles.emit(hx, hy, {
            vx: 0, vy: 0, vxRandom: 200, vyRandom: 200,
            life: 0.5, lifeRandom: 0.2,
            size: 5, sizeRandom: 3, endSize: 0,
            color: '#44ff88', endColor: '#ffffff',
            friction: 0.9, gravity: 60,
          }, 20);
          audio.playSFX('holeOpen', hx, hy);
          audio.playAnnouncement();
        } else {
          this.keyItem.homingSpeed += KEY_HOMING_ACCEL * dt;
          const step = Math.min(this.keyItem.homingSpeed * dt, dist);
          this.keyItem.x += (dx / dist) * step;
          this.keyItem.y += (dy / dist) * step;
        }
      } else {
        // Lazy trail behind player
        this.keyItem.x += (this.player.x - this.keyItem.x) * KEY_FOLLOW_SPEED * dt;
        this.keyItem.y += (this.player.y - this.keyItem.y) * KEY_FOLLOW_SPEED * dt;
      }
    }

    // Update HUD
    this.hud.update(dt, {
      lives: this.player.lives,
      timer: this.levelTimer,
      levelDepth: this.levelManager.levelDepth,
      challengeType: this.challengeDisplayName,
      timerActive: this.timerActive,
      bossHP: this.bossHP,
      bossMaxHP: this.bossMaxHP,
      generatorsDone: this.generators.filter(g => g.completed).length,
      generatorsTotal: this.generators.length,
    });

    // Check for game over after player update
    if (this.player.dead && !this.gameOverPushed) {
      this.gameOverPushed = true;
      audio.playExplosion();
      audio.stopGameplayMusic();
      this.game.pushScene(new GameOverScene(this.game, {
        levelDepth: this.levelManager.levelDepth,
        enemiesKilled: this.enemiesKilled,
        runLength: (performance.now() - this.runStartTime) / 1000,
      }));
    }
  }

  // ── Transition logic ──────────────────────────────────────────────────

  _updateTransition(dt) {
    this.transition.timer += dt;

    switch (this.transition.phase) {
      case 'falling':
        if (this.transition.timer >= FALL_DURATION) {
          // Rebuild level for next floor
          this._initLevel();
          // Switch to splash phase
          this.transition.phase = 'splash';
          this.transition.timer = 0;
          this._playSplashVoiceline();
          // Update HUD immediately with new depth/timer
          this.hud.update(0, {
            lives: this.player.lives,
            timer: this.levelTimer,
            levelDepth: this.levelManager.levelDepth,
            challengeType: this.challengeDisplayName,
            timerActive: this.timerActive,
            bossHP: this.bossHP,
            bossMaxHP: this.bossMaxHP,
            generatorsDone: this.generators.filter(g => g.completed).length,
            generatorsTotal: this.generators.length,
          });
        }
        break;

      case 'splash':
        if (this.transition.timer >= SPLASH_DURATION) {
          this.transition.phase = 'landing';
          this.transition.timer = 0;
          // First level: start music fresh; subsequent levels: just unduck
          if (audio.isGameplayMusicActive) {
            audio.unduckGameplayMusic();
          } else {
            audio.playGameplayMusic();
          }
          // Coffee break: crossfade to elevator music
          if (this.levelManager.challengeType === CHALLENGE_TYPES.COFFEE_BREAK) {
            audio.startElevatorMusic();
          }
        }
        break;

      case 'landing':
        if (this.transition.timer >= LAND_DURATION) {
          // Impact — squash + camera shake + zoom punch + particles + blast wave
          this.transition.phase = 'squash';
          this.transition.timer = 0;
          this.camera.shake(0.6);
          this.camera.zoomPunch(0.1);
          this.particles.addBlastWave(this.player.x, this.player.y, 50, 0.3);
          this.particles.emit(this.player.x, this.player.y, {
            vx: 0, vy: 0, vxRandom: 120, vyRandom: 60,
            life: 0.35, lifeRandom: 0.1,
            size: 3, sizeRandom: 2, endSize: 0,
            color: '#aaaaaa', endColor: '#666666',
            friction: 0.85, gravity: 80,
          }, 10);
          audio.playSFX('landing');
          audio.playExplosion();
        }
        // Fall through to tick shake
        this.camera._updateShake(dt);
        break;

      case 'squash':
        this.camera._updateShake(dt);
        if (this.transition.timer >= SQUASH_DURATION) {
          this.transition = null; // done — resume gameplay
        }
        break;
    }
  }

  /**
   * Check if player center is within a room's floor rect.
   */
  _isPlayerInRoom(roomIndex) {
    const room = this.level.rooms[roomIndex];
    const { x, y } = this.player;
    return x >= room.floorX && x <= room.floorX + room.floorWidth
        && y >= room.floorY && y <= room.floorY + room.floorHeight;
  }

  /**
   * Spawn a random enemy at a random floor position for Challenge/Boss trickle waves.
   */
  _spawnChallengeEnemy() {
    const enemy = spawnChallengeEnemy(
      this.level.rooms[0],
      this.enemies,
      {
        playerPos: { x: this.player.x, y: this.player.y },
        playerVel: { x: this.player.vx, y: this.player.vy },
        levelDepth: this.levelManager.levelDepth,
      },
    );
    enemy.startFall(0.8);
    this.enemies.push(enemy);
  }

  /**
   * Check for AABB overlap between player and any QTE-able enemy.
   * Returns the first overlapping enemy, or null.
   */
  _checkQTECollision() {
    const pAABB = {
      x: this.player.x - this.player.width / 2,
      y: this.player.y - this.player.height / 2,
      w: this.player.width,
      h: this.player.height,
    };

    for (const enemy of this.enemies) {
      if (!enemy.active || !enemy.canTriggerQTE) continue;

      const eAABB = {
        x: enemy.x - enemy.width / 2,
        y: enemy.y - enemy.height / 2,
        w: enemy.width,
        h: enemy.height,
      };

      if (checkAABB(pAABB, eAABB)) {
        return enemy;
      }
    }
    return null;
  }

  /**
   * Push the QTE scene for the given enemy.
   */
  _triggerQTE(enemy) {
    this.qteActive = true;

    this.game.pushScene(new QTEScene(this.game, {
      enemy,
      levelDepth: this.levelManager.levelDepth,
      onSuccess: (e) => {
        const blastX = e.x;
        const blastY = e.y;

        // Juice: hitstop, screen flash, shake, death burst, blast wave, zoom punch, kick
        this.hitstop.freeze(8);
        this.screenFlash.flash('#ffffff', 0.1);
        this.camera.shake(0.7);
        emitDeathBurst(this.particles, blastX, blastY, e.color || '#ff0000');
        emitCorpseLinger(this.particles, blastX, blastY, e.color || '#ff0000');
        this.particles.addBlastWave(blastX, blastY, BLAST_RADIUS * 0.6, 0.4, '#ffffff');
        this.camera.zoomPunch(0.15);
        this.camera.kick(blastX, blastY, 25);
        audio.playSFX('qteSuccess', blastX, blastY);
        audio.playExplosion();
        { const _v = ['easy', 'epic', 'goodjob', 'nice']; audio.playVoiceline(_v[Math.floor(Math.random() * _v.length)]); }

        // Corpse mark — colored debris on floor
        const offsets = [];
        const numDebris = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < numDebris; i++) {
          offsets.push({
            dx: (Math.random() - 0.5) * 16,
            dy: (Math.random() - 0.5) * 16,
            size: 3 + Math.random() * 2,
          });
        }
        this.corpseMarks.push({
          x: blastX, y: blastY,
          color: e.color || '#ff0000',
          alpha: 0.6,
          offsets,
        });

        // Kill the QTE target
        e.takeDamage();
        this.enemiesKilled++;
        this.enemiesKilledThisFloor++;

        // Destroy bullets in blast radius
        this.bullets.destroyInRadius(blastX, blastY, BLAST_RADIUS);

        // Knockback nearby enemies
        for (const other of this.enemies) {
          if (!other.active || other === e) continue;
          const dx = other.x - blastX;
          const dy = other.y - blastY;
          if (dx * dx + dy * dy <= BLAST_RADIUS * BLAST_RADIUS) {
            other.applyKnockback(blastX, blastY, KNOCKBACK_FORCE);
          }
        }

        // Heart: grant extra life (capped at 5)
        if (e.enemyType === 'heart') {
          this.player.addLife();
          audio.playSFX('lifeGain');
        }

        // Clock: grant +5 seconds to level timer
        if (e.enemyType === 'clock') {
          this.levelTimer += 5;
          audio.playSFX('timeBonus');
        }

        // Boss: decrement HP, open exit when defeated
        if (this.levelManager.challengeType === CHALLENGE_TYPES.BOSS && this.bossHP > 0) {
          this.bossHP--;
          if (this.bossHP <= 0) {
            this.challengeComplete = true;
            const hx = this.level.exitHoleX;
            const hy = this.level.exitHoleY;
            this.exitHole = { x: hx, y: hy, radius: EXIT_HOLE_RADIUS };
            achievements.onBossDefeated();
            // Juice: boss defeated hole opens
            this.camera.shake(0.6);
            this.screenFlash.flash('#44ff88', 0.15);
            this.particles.addBlastWave(hx, hy, 90, 0.45, '#44ff88');
            this.particles.emit(hx, hy, {
              vx: 0, vy: 0, vxRandom: 200, vyRandom: 200,
              life: 0.6, lifeRandom: 0.2,
              size: 6, sizeRandom: 3, endSize: 0,
              color: '#44ff88', endColor: '#ffffff',
              friction: 0.9, gravity: 50,
            }, 20);
            audio.playSFX('bossDefeat', hx, hy);
            audio.playAnnouncement();
          }
        }

        this.qteActive = false;
      },
      onFail: (e) => {
        // Juice: hitstop, screen flash red, shake, zoom punch
        this.hitstop.freeze(6);
        this.screenFlash.flash('#ff0000', 0.15);
        this.camera.shake(0.5);
        this.camera.zoomPunch(0.05);
        audio.playSFX('qteFail');
        audio.playExplosion();

        // Player takes damage (loses life + becomes invulnerable for 1s)
        this.player.damage();

        // Only play fail voiceline if the player survives; death screen has its own line
        if (!this.player.dead) {
          const _v = ['notdownyet', 'oof', 'youokthere', 'goodtry'];
          audio.playVoiceline(_v[Math.floor(Math.random() * _v.length)]);
        }

        // Player knockback away from enemy
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.player.x += (dx / dist) * 40;
        this.player.y += (dy / dist) * 40;

        // Player squash on damage
        this.player.squash(0.3, 0.15);

        // Enemy retreats away from player
        e.applyKnockback(this.player.x, this.player.y, RETREAT_KNOCKBACK_FORCE);

        this.qteActive = false;
      },
    }));
  }

  /**
   * Push a TapQTE for a generator (Power Up challenge).
   */
  _triggerGeneratorQTE(generator) {
    this.qteActive = true;
    const genProxy = {
      color: '#ffaa00',
      enemyType: 'generator',
      qteType: 'tap',
    };

    this.game.pushScene(new QTEScene(this.game, {
      enemy: genProxy,
      levelDepth: this.levelManager.levelDepth,
      onSuccess: () => {
        generator.completed = true;

        // Juice: shake + flash + particles + blast wave on generator activation
        this.camera.shake(0.4);
        this.screenFlash.flash('#ffaa00', 0.12);
        this.particles.addBlastWave(generator.x, generator.y, 60, 0.35, '#ffaa00');
        this.particles.emit(generator.x, generator.y, {
          vx: 0, vy: 0, vxRandom: 180, vyRandom: 180,
          life: 0.45, lifeRandom: 0.15,
          size: 5, sizeRandom: 3, endSize: 0,
          color: '#ffaa00', endColor: '#ffffff',
          friction: 0.9, gravity: 50,
        }, 15);
        audio.playSFX('generatorOn', generator.x, generator.y);
        audio.playExplosion();
        this.hitstop.freeze(6);
        this.camera.zoomPunch(0.1);
        { const _v = ['easy', 'epic', 'goodjob', 'nice']; audio.playVoiceline(_v[Math.floor(Math.random() * _v.length)]); }

        // Destroy bullets and knock back enemies near generator
        this.bullets.destroyInRadius(generator.x, generator.y, BLAST_RADIUS);
        for (const enemy of this.enemies) {
          if (!enemy.active) continue;
          const dx = enemy.x - generator.x;
          const dy = enemy.y - generator.y;
          if (dx * dx + dy * dy <= BLAST_RADIUS * BLAST_RADIUS) {
            enemy.applyKnockback(generator.x, generator.y, KNOCKBACK_FORCE);
          }
        }

        if (this.generators.every(g => g.completed)) {
          this.challengeComplete = true;
          const hx = this.level.exitHoleX;
          const hy = this.level.exitHoleY;
          this.exitHole = { x: hx, y: hy, radius: EXIT_HOLE_RADIUS };
          // Juice: all generators done, hole opens
          this.camera.shake(0.5);
          this.screenFlash.flash('#44ff88', 0.15);
          this.particles.addBlastWave(hx, hy, 80, 0.4, '#44ff88');
          this.particles.emit(hx, hy, {
            vx: 0, vy: 0, vxRandom: 180, vyRandom: 180,
            life: 0.5, lifeRandom: 0.2,
            size: 5, sizeRandom: 3, endSize: 0,
            color: '#44ff88', endColor: '#ffffff',
            friction: 0.9, gravity: 50,
          }, 18);
          audio.playSFX('holeOpen', hx, hy);
          audio.playAnnouncement();
        }
        this.qteActive = false;
      },
      onFail: () => {
        this.player.damage();
        this.qteActive = false;
      },
    }));
  }

  // ── Rendering ─────────────────────────────────────────────────────────

  render(ctx) {
    // Clear canvas background (screen-space, before camera transform)
    ctx.fillStyle = '#0e0e1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // --- World-space rendering (affected by camera) ---
    this.camera.applyTransform(ctx);

    // Draw level (rooms + hallways)
    this.level.render(ctx);

    // Draw exit hole (on floor, before entities)
    if (this.exitHole) {
      this._renderExitHole(ctx);
      if (this.tutorialType === CHALLENGE_TYPES.CHALLENGE) {
        this._renderChallengeArrow(ctx);
      }
    }

    // Draw key item (on floor before entities, follows player when collected)
    if (this.keyItem) {
      this._renderKeyItem(ctx);
      if (this.tutorialType === CHALLENGE_TYPES.FIND_THE_KEY && !this.keyItem.collected) {
        this._renderKeyArrow(ctx);
      }
    }

    // Draw generators (on floor before entities)
    for (const gen of this.generators) {
      this._renderGenerator(ctx, gen);
      if (this.tutorialType === CHALLENGE_TYPES.POWER_UP && !gen.completed) {
        this._renderGeneratorLabel(ctx, gen);
      }
    }

    // Draw floor marks (wall marks, scorch marks, corpse marks)
    this._renderFloorMarks(ctx);

    // Draw floor tutorial text
    if (this.floorText) this._renderFloorText(ctx);

    // Draw enemies (non-falling only — falling indicators drawn above player)
    for (const enemy of this.enemies) {
      if (enemy.active && !enemy.falling) enemy.render(ctx);
    }

    // Draw bullets
    this.bullets.render(ctx);

    // Draw upper particles (blast waves, death bursts) — world-space
    this.particles.render(ctx);

    // Draw player (with transition effects if active)
    if (this.transition) {
      this._renderTransitionPlayer(ctx);
    } else {
      this.player.render(ctx);
    }

    // Draw falling enemy indicators on top of player so they're always visible
    for (const enemy of this.enemies) {
      if (enemy.active && enemy.falling) enemy.render(ctx);
    }

    this.camera.removeTransform(ctx);

    // Screen flash overlay (full-screen, fine through CRT)
    this.screenFlash.render(ctx);

    // Vignette overlay
    this.vignette.render(ctx);

    // Splash overlay (covers everything during splash phase)
    if (this.transition && this.transition.phase === 'splash') {
      this._renderSplash(ctx);
    }
  }

  /** Screen-space HUD — rendered after CRT with barrel-matching transforms */
  renderOverlay(ctx) {
    // Render each HUD group with a transform matching the fisheye curvature
    // Lives — top-left
    this._renderHudWithBarrel(ctx, 50, 20, () => this.hud._renderLives(ctx));
    // Timer — top-center
    this._renderHudWithBarrel(ctx, CANVAS_WIDTH / 2, 24, () => this.hud._renderTimer(ctx));
    // Challenge type — top-center below timer
    this._renderHudWithBarrel(ctx, CANVAS_WIDTH / 2, 44, () => this.hud._renderChallengeType(ctx));
    // Level depth — top-right
    this._renderHudWithBarrel(ctx, CANVAS_WIDTH - 40, 24, () => this.hud._renderLevelDepth(ctx));
    // Boss HP — bottom-center
    this._renderHudWithBarrel(ctx, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40, () => this.hud._renderBossHP(ctx));
    // Generators — bottom-center
    this._renderHudWithBarrel(ctx, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40, () => this.hud._renderGenerators(ctx));
  }

  _renderHudWithBarrel(ctx, anchorX, anchorY, renderFn) {
    const t = crt.hudTransform(anchorX, anchorY);
    const offsetX = t.x - anchorX;
    const offsetY = t.y - anchorY;

    ctx.save();
    ctx.translate(anchorX + offsetX, anchorY + offsetY);
    ctx.rotate(t.rotation);
    ctx.translate(-(anchorX + offsetX), -(anchorY + offsetY));
    // Shift the rendering by the barrel offset
    ctx.translate(offsetX, offsetY);
    renderFn();
    ctx.restore();
  }

  _renderSplash(ctx) {
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    // Full-screen dark background
    ctx.fillStyle = '#0e0e1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Floor depth
    ctx.fillStyle = '#888888';
    ctx.font = '12px "Press Start 2P"';
    ctx.fillText(`FLOOR ${this.levelManager.levelDepth}`, cx, cy - 10);

    // Challenge name
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px "Press Start 2P"';
    ctx.fillText(this.challengeDisplayName, cx, cy + 30);

    // Timer bar (same layout as QTE bar, always white)
    const barW = 400;
    const barH = 12;
    const barY = 60;
    const barX = (CANVAS_WIDTH - barW) / 2;
    const fraction = Math.max(0, 1 - this.transition.timer / SPLASH_DURATION);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(barX, barY, barW * fraction, barH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  _renderKeyItem(ctx) {
    const { x, y, radius } = this.keyItem;
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.strokeStyle = '#aa8800';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  _renderGenerator(ctx, gen) {
    const { x, y, radius } = gen;

    if (gen.completed) {
      ctx.fillStyle = '#44ff88';
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = pulse;
      ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.globalAlpha = 1;
    }
  }

  _renderFloorMarks(ctx) {
    // Wall marks — dark gray circles
    if (this.wallMarks) {
      for (const mark of this.wallMarks) {
        ctx.globalAlpha = mark.alpha;
        ctx.fillStyle = '#111118';
        ctx.beginPath();
        ctx.arc(mark.x, mark.y, mark.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Corpse marks — colored debris squares
    if (this.corpseMarks) {
      for (const mark of this.corpseMarks) {
        ctx.globalAlpha = mark.alpha;
        ctx.fillStyle = mark.color;
        for (const off of mark.offsets) {
          ctx.fillRect(
            mark.x + off.dx - off.size / 2,
            mark.y + off.dy - off.size / 2,
            off.size, off.size,
          );
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  _renderFloorText(ctx) {
    const { lines, x, y } = this.floorText;
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === '') continue; // blank separator — skip but keep spacing
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

  _renderChallengeArrow(ctx) {
    const { x, y } = this.exitHole;
    const isRed = this.challengeFleeMode;
    const color = isRed ? '#ff4444' : '#44ff88';
    const label = isRed ? 'WAIT TO ENTER' : 'ENTER NOW';

    // Arrow triangle pointing down at hole
    const arrowY = y - 46;
    const arrowSize = 8;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - arrowSize, arrowY);
    ctx.lineTo(x + arrowSize, arrowY);
    ctx.lineTo(x, arrowY + arrowSize);
    ctx.closePath();
    ctx.fill();

    // Label above arrow
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, x, arrowY - 6);
    ctx.globalAlpha = 1;
  }

  _renderKeyArrow(ctx) {
    const { x, y } = this.keyItem;

    // Arrow triangle pointing down at key
    const arrowY = y - 24;
    const arrowSize = 8;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffdd44';
    ctx.beginPath();
    ctx.moveTo(x - arrowSize, arrowY);
    ctx.lineTo(x + arrowSize, arrowY);
    ctx.lineTo(x, arrowY + arrowSize);
    ctx.closePath();
    ctx.fill();

    // Labels above arrow
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('PICK UP THE KEY', x, arrowY - 20);
    ctx.fillText('BRING IT BACK', x, arrowY - 6);
    ctx.globalAlpha = 1;
  }

  _renderGeneratorLabel(ctx, gen) {
    const { x, y } = gen;

    // Arrow triangle pointing down at generator
    const arrowY = y - 28;
    const arrowSize = 6;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(x - arrowSize, arrowY);
    ctx.lineTo(x + arrowSize, arrowY);
    ctx.lineTo(x, arrowY + arrowSize);
    ctx.closePath();
    ctx.fill();

    // Label above arrow
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('RUN INTO IT', x, arrowY - 6);
    ctx.globalAlpha = 1;
  }

  _renderExitHole(ctx) {
    const { x, y, radius } = this.exitHole;

    // Dark hole fill
    ctx.fillStyle = EXIT_HOLE_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing border — red during challenge flee mode, green otherwise
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
    ctx.strokeStyle = this.challengeFleeMode ? EXIT_HOLE_FLEE_COLOR : EXIT_HOLE_BORDER_COLOR;
    ctx.lineWidth = EXIT_HOLE_BORDER_WIDTH;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _renderTransitionPlayer(ctx) {
    const tr = this.transition;
    const { width, height, color } = this.player;
    let drawX, drawY, scaleX, scaleY;

    switch (tr.phase) {
      case 'falling': {
        const t = Math.min(tr.timer / FALL_DURATION, 1);
        const eased = t * t; // ease-in: accelerates downward
        drawX = _lerp(tr.startX, tr.holeX, eased);
        drawY = _lerp(tr.startY, tr.holeY, eased);
        const s = 1 - eased * 0.85; // shrink toward 0.15
        scaleX = s;
        scaleY = s;
        break;
      }
      case 'landing': {
        const t = Math.min(tr.timer / LAND_DURATION, 1);
        const eased = t * t; // ease-in: accelerates downward, harsh stop
        drawX = this.player.x;
        drawY = this.player.y - LAND_DROP_HEIGHT * (1 - eased);
        scaleX = _lerp(0.6, 1, eased);
        scaleY = _lerp(0.6, 1, eased);
        break;
      }
      case 'squash': {
        const t = Math.min(tr.timer / SQUASH_DURATION, 1);
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

  onInput(event) {
  }
}

function _lerp(a, b, t) {
  return a + (b - a) * t;
}

export { GameplayScene };
