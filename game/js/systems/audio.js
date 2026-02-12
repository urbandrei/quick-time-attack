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

// Ambiance
const AMBIANCE_DRONE_PATH = 'sounds/421826__kinoton__dark-cave-drone.wav';
const AMBIANCE_DRIP_PATH = 'sounds/823211__akkaittou__waterdropletincave2.wav';
const AMBIANCE_DRONE_VOLUME = 0.35;
const AMBIANCE_DRIP_VOLUME = 0.25;
const AMBIANCE_DRIP_MIN_INTERVAL = 5;  // seconds
const AMBIANCE_DRIP_MAX_INTERVAL = 10; // seconds

// Gameplay music
const BASS_LOOP_PATH = 'sounds/251462__staticpony1__sick-dance-bass.wav';
const SHEPARD1_PATH = 'sounds/130502__enjoypa__rising-shepard-tone-60sec-take-2.wav';
const SHEPARD2_PATH = 'sounds/456929__1urker__shepard_tone_seamless.wav';
const BEEP_PATH = 'sounds/467882__samsterbirdies__beep-warning.ogg';
const BASS_VOLUME = 0.5;
const BASS_FADE_IN = 1.0;            // seconds
const SHEPARD_MAX_VOLUME = 0.3;
const BEEP_VOLUME = 0.6;
const WARNING_THRESHOLD = 10;         // seconds remaining
const BASS_PITCH_MAX = 1.3;           // bass pitch at time-up (1.0 at start)
const DUCK_AMOUNT = 0.35;             // gain multiplier when ducked (warning beep)
const SPLASH_DUCK = 0.25;             // gain multiplier during level splash screen
const PAUSE_PITCH = 0.5;              // playback rate when paused
const PAUSE_DUCK = 0.3;               // gain multiplier when paused

// Explosion SFX (file-based)
const EXPLOSION_PATH = 'sounds/93741__waveadventurer__explosion.mp3';
const EXPLOSION_OFFSET = 0.75;         // skip first 0.75s of the file
const EXPLOSION_VOLUME = 1.3;
const EXPLOSION_DURATION = 0.5;        // seconds — hard cutoff, much shorter than source
const EXPLOSION_FADE_START = 0.08;     // seconds — fade begins very early for longer tail
const EXPLOSION_PITCH = 1.5;

// PA announcement
const ANNOUNCE_PATH = 'sounds/Recording (3).m4a';
const ANNOUNCE_VOLUME = 2.0;
const ANNOUNCE_FILTER_FREQ = 1800;     // Hz — band-pass center (tinny speaker)
const ANNOUNCE_FILTER_Q = 3.5;         // narrower = more telephone-like
const ANNOUNCE_DISTORTION = 80;        // waveshaper curve steepness — heavy clipping

// Voicelines (use same PA processing as announcements)
const VOICELINE_PATH = 'sounds/voicelines/';
const VOICELINE_NAMES = [
  'key', 'easy', 'epic', 'goodjob', 'nice',
  'notdownyet', 'oof', 'youokthere', 'goodtry',
  'bossfightincoming', 'challengeroom', 'findthekey',
  'generators', 'killthemall', 'wellfixyouup',
  'hello', 'green', 'missmyfamily', 'rickroll',
];

// QTE speedup — exponential from 1.0 → QTE_PITCH_MAX over the QTE duration
const QTE_PITCH_MAX = 1.8;

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

    // Ambiance
    this._droneBuffer = null;
    this._dripBuffer = null;
    this._droneSource = null;
    this._droneGain = null;
    this._dripTimer = 0;
    this._dripInterval = AMBIANCE_DRIP_MIN_INTERVAL + Math.random() * (AMBIANCE_DRIP_MAX_INTERVAL - AMBIANCE_DRIP_MIN_INTERVAL);
    this._ambianceStarted = false;

    // Gameplay music
    this._bassBuffer = null;
    this._shepard1Buffer = null;
    this._shepard2Buffer = null;
    this._beepBuffer = null;
    this._bassSource = null;
    this._shepard1Source = null;
    this._shepard2Source = null;
    this._bassGain = null;
    this._shepard1Gain = null;
    this._shepard2Gain = null;
    this._gameplayMusicGain = null;
    this._gameplayMusicActive = false;
    this._bassFadeTimer = 0;

    // QTE mode
    this._qteMode = false;

    // Warning beep
    this._warningActive = false;
    this._beepSource = null;
    this._beepGain = null;

    // Explosion
    this._explosionBuffer = null;

    // PA announcement
    this._announceBuffer = null;

    // Voicelines
    this._voicelineBuffers = {};
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    this.engine.init();
    this._loadVolumes();
    this._loadAmbianceBuffers();
  }

  resume() {
    this.engine.resume();
    this._startAmbiance();
  }

  update(dt) {
    this._updateAmbiance(dt);
    this._updateGameplayMusic(dt);
  }

  get isGameplayMusicActive() { return this._gameplayMusicActive; }

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

  /**
   * Play the explosion sound (trimmed, with exponential tail fade).
   * @param {number} [volume=EXPLOSION_VOLUME]
   */
  playExplosion(volume = EXPLOSION_VOLUME) {
    const ctx = this.engine.ctx;
    if (!ctx || !this._explosionBuffer) return;

    const now = ctx.currentTime;
    const endTime = now + EXPLOSION_DURATION;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.setValueAtTime(volume, now + EXPLOSION_FADE_START);
    gain.gain.exponentialRampToValueAtTime(0.001, endTime);
    gain.connect(this.engine.sfxGain);

    const src = ctx.createBufferSource();
    src.buffer = this._explosionBuffer;
    src.playbackRate.value = EXPLOSION_PITCH;
    src.connect(gain);
    src.start(now, EXPLOSION_OFFSET);
    src.stop(endTime + 0.01);
  }

  /**
   * Play the PA announcement with robotic/autotuned processing.
   * Chain: source → bandpass → waveshaper → compressor → gain → sfxBus
   */
  playAnnouncement() {
    this._playWithPAProcessing(this._announceBuffer);
  }

  /**
   * Play a voiceline by name with PA processing.
   * @param {string} name - voiceline file name (without path/extension)
   */
  playVoiceline(name) {
    const buffer = this._voicelineBuffers[name];
    if (buffer) this._playWithPAProcessing(buffer);
  }

  /**
   * Play an AudioBuffer through the PA processing chain.
   * Chain: source → bandpass → waveshaper → compressor → gain → sfxBus
   */
  _playWithPAProcessing(buffer) {
    const ctx = this.engine.ctx;
    if (!ctx || !buffer) return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = ANNOUNCE_FILTER_FREQ;
    filter.Q.value = ANNOUNCE_FILTER_Q;

    const shaper = ctx.createWaveShaper();
    const k = ANNOUNCE_DISTORTION;
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
    }
    shaper.curve = curve;
    shaper.oversample = '2x';

    // Low-pass filter — cuts harsh high-frequency harmonics from distortion
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 3500;
    lpf.Q.value = 0.7;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -30;
    compressor.knee.value = 5;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;

    const gain = ctx.createGain();
    gain.gain.value = ANNOUNCE_VOLUME;

    filter.connect(shaper);
    shaper.connect(lpf);
    lpf.connect(compressor);
    compressor.connect(gain);
    gain.connect(this.engine.sfxGain);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(filter);
    src.start();
  }

  // ── Gameplay music ───────────────────────────────────────────────────

  /**
   * Start gameplay music: bass loop (faded in), shepard tones (silent, grow via setLevelProgress).
   */
  playGameplayMusic() {
    if (this._gameplayMusicActive) this.stopGameplayMusic();
    const ctx = this.engine.ctx;
    if (!ctx) return;

    this._gameplayMusicActive = true;
    this._bassFadeTimer = 0;
    this._warningActive = false;
    this._qteMode = false;

    // All gameplay music goes through this gain node (used for ducking)
    this._gameplayMusicGain = ctx.createGain();
    this._gameplayMusicGain.gain.value = 1.0;
    this._gameplayMusicGain.connect(this.engine.musicGain);

    // Bass loop — starts silent, fades in
    if (this._bassBuffer) {
      this._bassGain = ctx.createGain();
      this._bassGain.gain.value = 0;
      this._bassGain.connect(this._gameplayMusicGain);
      this._bassSource = ctx.createBufferSource();
      this._bassSource.buffer = this._bassBuffer;
      this._bassSource.loop = true;
      this._bassSource.connect(this._bassGain);
      this._bassSource.start();
    }

    // Shepard tone 1 — starts silent, volume driven by setLevelProgress
    if (this._shepard1Buffer) {
      this._shepard1Gain = ctx.createGain();
      this._shepard1Gain.gain.value = 0;
      this._shepard1Gain.connect(this._gameplayMusicGain);
      this._shepard1Source = ctx.createBufferSource();
      this._shepard1Source.buffer = this._shepard1Buffer;
      this._shepard1Source.loop = true;
      this._shepard1Source.connect(this._shepard1Gain);
      this._shepard1Source.start();
    }

    // Shepard tone 2
    if (this._shepard2Buffer) {
      this._shepard2Gain = ctx.createGain();
      this._shepard2Gain.gain.value = 0;
      this._shepard2Gain.connect(this._gameplayMusicGain);
      this._shepard2Source = ctx.createBufferSource();
      this._shepard2Source.buffer = this._shepard2Buffer;
      this._shepard2Source.loop = true;
      this._shepard2Source.connect(this._shepard2Gain);
      this._shepard2Source.start();
    }
  }

  stopGameplayMusic() {
    if (!this._gameplayMusicActive) return;
    this._gameplayMusicActive = false;

    const stop = (src) => { try { if (src) src.stop(); } catch {} };
    stop(this._bassSource);
    stop(this._shepard1Source);
    stop(this._shepard2Source);
    this._stopWarningBeep();

    this._bassSource = null;
    this._shepard1Source = null;
    this._shepard2Source = null;
    this._bassGain = null;
    this._shepard1Gain = null;
    this._shepard2Gain = null;
    this._gameplayMusicGain = null;
  }

  /**
   * Reset pitch/volumes for a new level and duck music for the splash screen.
   * Music keeps playing — no stop/start.
   */
  resetLevelMusic() {
    if (!this._gameplayMusicActive) return;
    const ctx = this.engine.ctx;

    this._stopWarningBeep();
    this._qteMode = false;

    // Reset bass pitch and volume
    if (this._bassSource) this._bassSource.playbackRate.value = 1.0;
    if (this._bassGain) this._bassGain.gain.value = BASS_VOLUME;
    this._bassFadeTimer = BASS_FADE_IN; // already faded in

    // Reset shepard volumes to silent
    if (this._shepard1Gain) this._shepard1Gain.gain.value = 0;
    if (this._shepard2Gain) this._shepard2Gain.gain.value = 0;
    if (this._shepard1Source) this._shepard1Source.playbackRate.value = 1.0;
    if (this._shepard2Source) this._shepard2Source.playbackRate.value = 1.0;

    // Duck for splash screen voiceover
    if (ctx && this._gameplayMusicGain) {
      this._gameplayMusicGain.gain.setTargetAtTime(SPLASH_DUCK, ctx.currentTime, 0.15);
    }
  }

  /**
   * Restore music volume after splash screen.
   */
  unduckGameplayMusic() {
    if (!this._gameplayMusicActive) return;
    const ctx = this.engine.ctx;
    if (ctx && this._gameplayMusicGain) {
      this._gameplayMusicGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.15);
    }
  }

  /**
   * Slow down and pitch down gameplay music (pause menu).
   */
  pauseGameplayMusic() {
    if (!this._gameplayMusicActive) return;
    const ctx = this.engine.ctx;
    this._setGameplayRate(PAUSE_PITCH);
    if (ctx && this._gameplayMusicGain) {
      this._gameplayMusicGain.gain.setTargetAtTime(PAUSE_DUCK, ctx.currentTime, 0.1);
    }
  }

  /**
   * Restore gameplay music from pause.
   */
  unpauseGameplayMusic() {
    if (!this._gameplayMusicActive) return;
    const ctx = this.engine.ctx;
    this._setGameplayRate(1.0);
    if (ctx && this._gameplayMusicGain) {
      this._gameplayMusicGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.1);
    }
  }

  /**
   * Update shepard tone volumes and warning beep based on level timer.
   * @param {number} levelTimer - seconds remaining
   * @param {number} levelTimeTotal - total level time in seconds
   */
  setLevelProgress(levelTimer, levelTimeTotal) {
    if (!this._gameplayMusicActive || levelTimeTotal <= 0) return;

    // Progress: 0 at start → 1 at time-up
    const progress = 1 - levelTimer / levelTimeTotal;
    const shepardVol = progress * SHEPARD_MAX_VOLUME;
    if (this._shepard1Gain) this._shepard1Gain.gain.value = shepardVol;
    if (this._shepard2Gain) this._shepard2Gain.gain.value = shepardVol;

    // Bass pitch rises with progress (only when not in QTE mode, which controls rate separately)
    if (!this._qteMode && this._bassSource) {
      this._bassSource.playbackRate.value = 1.0 + (BASS_PITCH_MAX - 1.0) * progress;
    }

    // Warning beep in last N seconds
    if (levelTimer <= WARNING_THRESHOLD && levelTimer > 0) {
      if (!this._warningActive) this._startWarningBeep();
    } else {
      if (this._warningActive) this._stopWarningBeep();
    }
  }

  // ── QTE mode ──────────────────────────────────────────────────────────

  enterQTEMode() {
    this._qteMode = true;
    this._setGameplayRate(1.0);
  }

  exitQTEMode() {
    this._qteMode = false;
    this._setGameplayRate(1.0);
  }

  /**
   * @param {number} progress - 0 at QTE start → 1 at timeout
   */
  setQTEProgress(progress) {
    if (!this._qteMode) return;
    // Exponential curve: starts at 1.0, barely moves at first, rockets up near the end
    // rate = 1.0 * (max/1.0)^progress  →  at p=0: 1.0, at p=1: QTE_PITCH_MAX
    const rate = Math.pow(QTE_PITCH_MAX, progress);
    this._setGameplayRate(rate);
  }

  _setGameplayRate(rate) {
    if (this._bassSource) this._bassSource.playbackRate.value = rate;
    if (this._shepard1Source) this._shepard1Source.playbackRate.value = rate;
    if (this._shepard2Source) this._shepard2Source.playbackRate.value = rate;
  }

  // stubs for unused callers
  playMusic() {}
  stopMusic() {}
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

  // ── Ambiance ─────────────────────────────────────────────────────────

  _loadAmbianceBuffers() {
    const ctx = this.engine.ctx;
    if (!ctx) return;

    const load = (path) =>
      fetch(path)
        .then(r => r.arrayBuffer())
        .then(buf => ctx.decodeAudioData(buf))
        .catch(() => null);

    load(AMBIANCE_DRONE_PATH).then(buf => {
      this._droneBuffer = buf;
      this._startAmbiance();
    });
    load(AMBIANCE_DRIP_PATH).then(buf => { this._dripBuffer = buf; });

    // Gameplay music buffers
    load(BASS_LOOP_PATH).then(buf => { this._bassBuffer = buf; });
    load(SHEPARD1_PATH).then(buf => { this._shepard1Buffer = buf; });
    load(SHEPARD2_PATH).then(buf => { this._shepard2Buffer = buf; });
    load(BEEP_PATH).then(buf => { this._beepBuffer = buf; });
    load(EXPLOSION_PATH).then(buf => { this._explosionBuffer = buf; });
    load(ANNOUNCE_PATH).then(buf => { this._announceBuffer = buf; });

    // Voiceline buffers
    for (const name of VOICELINE_NAMES) {
      load(`${VOICELINE_PATH}${name}.m4a`).then(buf => {
        if (buf) this._voicelineBuffers[name] = buf;
      });
    }
  }

  _startAmbiance() {
    if (this._ambianceStarted || !this._droneBuffer) return;
    const ctx = this.engine.ctx;
    if (!ctx || ctx.state === 'suspended') return;

    this._ambianceStarted = true;

    // Drone loop routed through the music gain bus
    this._droneGain = ctx.createGain();
    this._droneGain.gain.value = AMBIANCE_DRONE_VOLUME;
    this._droneGain.connect(this.engine.musicGain);

    this._droneSource = ctx.createBufferSource();
    this._droneSource.buffer = this._droneBuffer;
    this._droneSource.loop = true;
    this._droneSource.connect(this._droneGain);
    this._droneSource.start();
  }

  _updateAmbiance(dt) {
    // Try starting drone if AudioContext was resumed after buffers loaded
    if (!this._ambianceStarted && this._droneBuffer) {
      this._startAmbiance();
    }

    if (!this._dripBuffer || !this._ambianceStarted) return;

    this._dripTimer += dt;
    if (this._dripTimer >= this._dripInterval) {
      this._dripTimer = 0;
      this._dripInterval = AMBIANCE_DRIP_MIN_INTERVAL + Math.random() * (AMBIANCE_DRIP_MAX_INTERVAL - AMBIANCE_DRIP_MIN_INTERVAL);

      const ctx = this.engine.ctx;
      if (!ctx) return;

      const gain = ctx.createGain();
      gain.gain.value = AMBIANCE_DRIP_VOLUME * (0.7 + Math.random() * 0.3);
      gain.connect(this.engine.musicGain);

      const src = ctx.createBufferSource();
      src.buffer = this._dripBuffer;
      // Slight pitch variation
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      src.connect(gain);
      src.start();
    }
  }

  // ── Gameplay music update ────────────────────────────────────────────

  _updateGameplayMusic(dt) {
    if (!this._gameplayMusicActive) return;

    // Bass fade-in
    if (this._bassFadeTimer < BASS_FADE_IN && this._bassGain) {
      this._bassFadeTimer += dt;
      const t = Math.min(this._bassFadeTimer / BASS_FADE_IN, 1);
      // Ease-in (quadratic)
      this._bassGain.gain.value = (t * t) * BASS_VOLUME;
    }
  }

  _startWarningBeep() {
    if (this._warningActive) return;
    const ctx = this.engine.ctx;
    if (!ctx || !this._beepBuffer) return;

    this._warningActive = true;

    // Duck gameplay music
    if (this._gameplayMusicGain) {
      this._gameplayMusicGain.gain.setTargetAtTime(DUCK_AMOUNT, ctx.currentTime, 0.1);
    }

    // Beep loop — bypasses duck by connecting directly to music bus
    this._beepGain = ctx.createGain();
    this._beepGain.gain.value = BEEP_VOLUME;
    this._beepGain.connect(this.engine.musicGain);

    this._beepSource = ctx.createBufferSource();
    this._beepSource.buffer = this._beepBuffer;
    this._beepSource.loop = true;
    this._beepSource.connect(this._beepGain);
    this._beepSource.start();
  }

  _stopWarningBeep() {
    if (!this._warningActive) return;
    this._warningActive = false;

    try { if (this._beepSource) this._beepSource.stop(); } catch {}
    this._beepSource = null;
    this._beepGain = null;

    // Unduck gameplay music
    const ctx = this.engine.ctx;
    if (ctx && this._gameplayMusicGain) {
      this._gameplayMusicGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.1);
    }
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
