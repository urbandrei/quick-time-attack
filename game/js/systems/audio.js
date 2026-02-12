/**
 * AudioManager — Singleton coordinating all game audio.
 * SFX playback and volume control.
 */

import { ChiptuneEngine } from './chiptuneEngine.js';
import { SFX } from './sfxLibrary.js';
import { VOLUME_STORAGE_KEY, DEFAULT_VOLUMES } from '../menus/settings.js';

// SFX throttle: max N of same SFX within this window
const SFX_THROTTLE_MAX = 4;
const SFX_THROTTLE_WINDOW = 0.05; // seconds

// Spatial audio: full volume within inner radius, silent beyond outer
const SPATIAL_INNER = 80;   // px — full volume
const SPATIAL_OUTER = 600;  // px — silence

class AudioManager {
  constructor() {
    this.engine = new ChiptuneEngine();
    this._initialized = false;
    this._sfxVolume = 0.8;
    this._musicVolume = 0.8;

    // Listener position (player)
    this._listenerX = 0;
    this._listenerY = 0;

    // SFX throttle tracking: { sfxId: [timestamp, ...] }
    this._sfxTimestamps = {};
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    this.engine.init();
    this._loadVolumes();
  }

  resume() {
    this.engine.resume();
  }

  update(dt) {}

  /** Set listener position (call each frame with the player's world position). */
  setListenerPosition(x, y) {
    this._listenerX = x;
    this._listenerY = y;
  }

  // ── SFX ──────────────────────────────────────────────────────────────

  /**
   * @param {string} id - SFX id from sfxLibrary
   * @param {number} [x] - World X position of the sound source
   * @param {number} [y] - World Y position of the sound source
   *   If x/y are omitted the sound plays at full volume (non-positional).
   */
  playSFX(id, x, y) {
    if (!this._initialized || !SFX[id]) return;

    // Spatial attenuation
    let spatialMult = 1;
    if (x != null && y != null) {
      const dx = x - this._listenerX;
      const dy = y - this._listenerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= SPATIAL_OUTER) return; // too far, skip entirely
      if (dist > SPATIAL_INNER) {
        spatialMult = 1 - (dist - SPATIAL_INNER) / (SPATIAL_OUTER - SPATIAL_INNER);
      }
    }

    const now = this.engine.now;

    // Throttle: skip if too many of same SFX recently
    if (!this._sfxTimestamps[id]) this._sfxTimestamps[id] = [];
    const stamps = this._sfxTimestamps[id];

    // Remove old timestamps
    while (stamps.length > 0 && now - stamps[0] > SFX_THROTTLE_WINDOW) {
      stamps.shift();
    }
    if (stamps.length >= SFX_THROTTLE_MAX) return;
    stamps.push(now);

    // Pitch/volume variation: ±15% pitch, ±10% volume
    const pitchMult = 0.85 + Math.random() * 0.3;
    const volMult = (0.9 + Math.random() * 0.2) * spatialMult;

    SFX[id](this.engine, pitchMult, volMult);
  }

  // ── Music stubs (no-op until music is implemented) ─────────────────

  playMusic() {}
  stopMusic() {}
  playGameplayMusic() {}
  playQTEMotif() {}
  stopQTEMotif() {}
  duckMusic() {}

  // ── Volume ───────────────────────────────────────────────────────────

  setSFXVolume(v) {
    this._sfxVolume = v;
    this.engine.setSFXVolume(v);
    this._saveVolumes();
  }

  setMusicVolume(v) {
    this._musicVolume = v;
    this.engine.setMusicVolume(v);
    this._saveVolumes();
  }

  // ── Internal ─────────────────────────────────────────────────────────

  _loadVolumes() {
    try {
      const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        this._sfxVolume = typeof stored.sfx === 'number' ? stored.sfx : DEFAULT_VOLUMES.sfx;
        this._musicVolume = typeof stored.music === 'number' ? stored.music : DEFAULT_VOLUMES.music;
      } else {
        this._sfxVolume = DEFAULT_VOLUMES.sfx;
        this._musicVolume = DEFAULT_VOLUMES.music;
      }
    } catch {
      this._sfxVolume = DEFAULT_VOLUMES.sfx;
      this._musicVolume = DEFAULT_VOLUMES.music;
    }

    this.engine.setSFXVolume(this._sfxVolume);
    this.engine.setMusicVolume(this._musicVolume);
  }

  _saveVolumes() {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify({
        sfx: this._sfxVolume,
        music: this._musicVolume,
      }));
    } catch { /* silent */ }
  }
}

export const audio = new AudioManager();
