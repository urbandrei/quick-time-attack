import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../game.js';
import { input } from '../input.js';
import { PauseScene } from './pauseScene.js';
import { GameOverScene } from './gameOverScene.js';
import { QTEScene } from './qteScene.js';
import { Level } from '../levels/level.js';
import { LEVEL_LAYOUTS } from '../levels/levelData.js';
import { getWallSegments, checkCircleCollision, checkAABB } from '../collision.js';
import { Player } from '../player.js';
import { Camera } from '../camera.js';
import { BulletPool } from '../bullet.js';
import { Enemy } from '../enemies/enemy.js';
import { Bat } from '../enemies/bat.js';

// Map spawn-point type → class (fall back to base Enemy for unimplemented types)
const ENEMY_CLASSES = {
  bat: Bat,
};

// Number of frames within which a bullet hit is nullified by a QTE trigger
const QTE_PRIORITY_FRAMES = 3;

// QTE blast constants
const BLAST_RADIUS = 240;          // half room width
const KNOCKBACK_FORCE = 400;       // px/s initial impulse
const QTE_SUCCESS_SCORE = 100;     // base score per QTE kill
const BULLET_CANCEL_SCORE = 5;     // bonus per bullet destroyed in blast
const RETREAT_KNOCKBACK_FORCE = 300; // enemy retreat force on QTE failure

class GameplayScene {
  constructor(game) {
    this.game = game;
  }

  enter() {
    if (this.player) return;

    // Build the level from the first layout
    this.level = new Level(LEVEL_LAYOUTS[0]);

    // Cache wall segments for collision
    this.walls = getWallSegments(this.level);

    // Place the player at the level's designated start
    this.player = new Player({
      x: this.level.playerStartX,
      y: this.level.playerStartY,
    });

    // Camera — snap to player immediately so there's no lerp-from-origin
    this.camera = new Camera();
    this.camera.snapTo(this.player.x, this.player.y);

    // Bullet pool
    this.bullets = new BulletPool();

    // Spawn enemies from room spawn-point data
    this.enemies = [];
    for (const room of this.level.rooms) {
      for (const sp of room.getWorldSpawnPoints()) {
        const EnemyClass = ENEMY_CLASSES[sp.type] || Enemy;
        this.enemies.push(new EnemyClass({ x: sp.x, y: sp.y, enemyType: sp.type }));
      }
    }

    // QTE priority tracking
    this.frameCount = 0;
    this.bulletDamageFrame = -Infinity;
    this.qteActive = false;

    // Score
    this.score = 0;
  }

  exit() {}

  update(dt) {
    if (input.isActionJustPressed('pause')) {
      this.game.pushScene(new PauseScene(this.game));
      return;
    }

    this.frameCount++;

    this.player.update(dt, this.walls);
    this.bullets.update(dt, this.walls);

    // Update enemies
    for (const enemy of this.enemies) {
      enemy.update(dt, this.walls, this.player);
    }

    // ── Player-enemy QTE collision (AABB vs AABB, checked FIRST) ──────
    // QTE takes priority over bullet damage within a 3-frame window.
    if (!this.player.dead && !this.player.invulnerable && !this.qteActive) {
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
          }
        }
      }
    }

    // ── Lunging bat vs player (bat acts as projectile during lunge) ───
    if (!this.player.dead && !this.player.invulnerable) {
      for (const enemy of this.enemies) {
        if (!enemy.active || !enemy.isLunging) continue;

        const result = checkCircleCollision(
          enemy.x, enemy.y, enemy.lungeRadius,
          this.player.x, this.player.y, this.player.bulletRadius
        );

        if (result.hit) {
          this.player.damage();
          break; // only one damage per frame
        }
      }
    }

    this.camera.update(dt, this.player, input.getMousePos());

    // Check for game over after player update (guard against re-push)
    if (this.player.dead && !this.gameOverPushed) {
      this.gameOverPushed = true;
      this.game.pushScene(new GameOverScene(this.game));
    }
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
      onSuccess: (e) => {
        const blastX = e.x;
        const blastY = e.y;

        // Kill the QTE target
        e.takeDamage();

        // Destroy bullets in blast radius
        const bulletsDestroyed = this.bullets.destroyInRadius(blastX, blastY, BLAST_RADIUS);

        // Knockback nearby enemies
        for (const other of this.enemies) {
          if (!other.active || other === e) continue;
          const dx = other.x - blastX;
          const dy = other.y - blastY;
          if (dx * dx + dy * dy <= BLAST_RADIUS * BLAST_RADIUS) {
            other.applyKnockback(blastX, blastY, KNOCKBACK_FORCE);
          }
        }

        // Award score
        const earned = QTE_SUCCESS_SCORE + bulletsDestroyed * BULLET_CANCEL_SCORE;
        this.score += earned;

        this.qteActive = false;
      },
      onFail: (e) => {
        // Player takes damage (loses life + becomes invulnerable for 1s)
        this.player.damage();

        // Enemy retreats away from player
        e.applyKnockback(this.player.x, this.player.y, RETREAT_KNOCKBACK_FORCE);

        this.qteActive = false;
      },
    }));
  }

  render(ctx) {
    // Clear canvas background (screen-space, before camera transform)
    ctx.fillStyle = '#0e0e1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // --- World-space rendering (affected by camera) ---
    this.camera.applyTransform(ctx);

    // Draw level (rooms + hallways)
    this.level.render(ctx);

    // Draw enemies
    for (const enemy of this.enemies) {
      if (enemy.active) enemy.render(ctx);
    }

    // Draw bullets
    this.bullets.render(ctx);

    // Draw player
    this.player.render(ctx);

    this.camera.removeTransform(ctx);

    // --- Screen-space rendering (HUD, unaffected by camera) ---
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WASD = Move | Esc = Pause | Walk into enemy = QTE', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 12);
  }

  onInput(event) {
  }
}

export { GameplayScene };
