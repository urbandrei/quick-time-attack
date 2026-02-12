// ── Easing helpers (local, minimal) ──────────────────────────────────
function easeOutQuad(t) { return t * (2 - t); }
function easeInQuad(t) { return t * t; }

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(c1, c2, t) {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

// ── Particle ─────────────────────────────────────────────────────────

class Particle {
  constructor(x, y, config) {
    this.x = x;
    this.y = y;
    this.vx = config.vx || 0;
    this.vy = config.vy || 0;
    this.life = config.life || 0.5;
    this.maxLife = this.life;
    this.size = config.size || 4;
    this.endSize = config.endSize ?? 0;
    this.color = config.color || '#ffffff';
    this.endColor = config.endColor || null;
    this.gravity = config.gravity || 0;
    this.friction = config.friction || 0.98;
    this.rotation = config.rotation || 0;
    this.rotationSpeed = config.rotationSpeed || 0;
  }

  update(dt) {
    this.life -= dt;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotationSpeed * dt;
    return this.life > 0;
  }

  render(ctx) {
    const t = 1 - (this.life / this.maxLife); // 0 → 1 over lifetime
    const size = lerp(this.size, this.endSize, t);
    if (size <= 0) return;

    const alpha = this.life / this.maxLife;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    if (this.rotation) ctx.rotate(this.rotation);
    ctx.fillStyle = this.endColor ? lerpColor(this.color, this.endColor, t) : this.color;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

// ── Particle Pool ────────────────────────────────────────────────────

export class ParticlePool {
  constructor(maxParticles = 500) {
    this.particles = [];
    this.max = maxParticles;
    this.blastWaves = [];
  }

  /**
   * Emit particles at (x, y) with given config.
   * Config fields: vx, vy, vxRandom, vyRandom, life, lifeRandom,
   *   size, sizeRandom, endSize, color, endColor, gravity, friction,
   *   rotation, rotationSpeed.
   */
  emit(x, y, config, count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) break;
      this.particles.push(new Particle(x, y, {
        ...config,
        vx: (config.vx || 0) + (config.vxRandom || 0) * (Math.random() - 0.5) * 2,
        vy: (config.vy || 0) + (config.vyRandom || 0) * (Math.random() - 0.5) * 2,
        life: (config.life || 0.5) + (config.lifeRandom || 0) * (Math.random() - 0.5) * 2,
        size: (config.size || 4) + (config.sizeRandom || 0) * (Math.random() - 0.5) * 2,
        rotationSpeed: config.rotationSpeed || (Math.random() - 0.5) * 6,
      }));
    }
  }

  /** Add a blast wave ring effect. */
  addBlastWave(x, y, maxRadius, duration = 0.4, color = '#ffffff') {
    this.blastWaves.push(new BlastWaveEffect(x, y, maxRadius, duration, color));
  }

  update(dt) {
    this.particles = this.particles.filter(p => p.update(dt));
    this.blastWaves = this.blastWaves.filter(bw => bw.update(dt));
  }

  /** Render particles (call during world-space rendering, affected by camera). */
  render(ctx) {
    for (const p of this.particles) {
      p.render(ctx);
    }
    for (const bw of this.blastWaves) {
      bw.render(ctx);
    }
  }
}

// ── Blast Wave Effect ────────────────────────────────────────────────

class BlastWaveEffect {
  constructor(x, y, maxRadius, duration = 0.4, color = '#ffffff') {
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.color = color;
    this.timer = 0;
  }

  update(dt) {
    this.timer += dt;
    return this.timer < this.duration;
  }

  render(ctx) {
    const t = this.timer / this.duration;
    const radius = easeOutQuad(t) * this.maxRadius;
    const alpha = 1 - easeInQuad(t);
    const lineWidth = lerp(8, 1, t);

    ctx.save();

    // Outer ring
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring — thinner, slightly behind outer
    const innerRadius = easeOutQuad(Math.max(0, t - 0.08)) * this.maxRadius;
    if (innerRadius > 0) {
      ctx.globalAlpha = alpha * 0.4;
      ctx.lineWidth = Math.max(1, lineWidth * 0.4);
      ctx.beginPath();
      ctx.arc(this.x, this.y, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Particle recipes ─────────────────────────────────────────────────

/**
 * Enemy death burst — 25 particles radiating from center.
 * @param {ParticlePool} pool
 * @param {number} x
 * @param {number} y
 * @param {string} color - Enemy color
 */
export function emitDeathBurst(pool, x, y, color) {
  pool.emit(x, y, {
    vx: 0, vy: 0, vxRandom: 300, vyRandom: 300,
    life: 0.6, lifeRandom: 0.3,
    size: 6, sizeRandom: 4, endSize: 0,
    color: color, endColor: '#ff8800',
    friction: 0.92, gravity: 100,
  }, 25);
}

/**
 * Wall impact dust — 3-5 small particles puffing away from wall.
 * @param {ParticlePool} pool
 * @param {number} x - Hit position
 * @param {number} y - Hit position
 * @param {number} nx - Wall normal X (direction away from wall)
 * @param {number} ny - Wall normal Y
 */
export function emitWallDust(pool, x, y, nx, ny) {
  pool.emit(x, y, {
    vx: nx * 80, vy: ny * 80, vxRandom: 40, vyRandom: 40,
    life: 0.3, lifeRandom: 0.1,
    size: 3, sizeRandom: 2, endSize: 0,
    color: '#aaaaaa', friction: 0.9,
  }, 4);
}
