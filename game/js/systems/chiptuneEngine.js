// Note-to-frequency lookup table
const NOTE_FREQ = {
  'C2': 65.41, 'C#2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'E2': 82.41,
  'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00,
  'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81,
  'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00,
  'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63,
  'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00,
  'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.26,
  'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00,
  'A#5': 932.33, 'B5': 987.77,
  'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51, 'F6': 1396.91, 'G6': 1567.98,
  'A6': 1760.00, 'B6': 1975.53,
};

export function noteToFreq(note) {
  return NOTE_FREQ[note] || 440;
}

export class ChiptuneEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this._noiseBuffer = null;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master → destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    // SFX bus → master
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);

    // Music bus → master
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);

    // Pre-generate white noise buffer (1 second)
    this._generateNoiseBuffer();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _generateNoiseBuffer() {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate; // 1 second
    this._noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = this._noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Play a tone with ADSR envelope.
   * @param {number} freq - Frequency in Hz
   * @param {number} duration - Total duration in seconds
   * @param {string} waveform - 'sine', 'square', 'triangle', 'sawtooth'
   * @param {object} envelope - { attack, decay, sustain, release } in seconds (sustain is level 0-1)
   * @param {GainNode} [busNode] - Bus to connect to (defaults to sfxGain)
   * @param {number} [volume=0.3] - Peak volume
   * @param {number} [startTime] - Scheduled start time (defaults to now)
   * @returns {{ osc: OscillatorNode, gain: GainNode }} for further manipulation
   */
  playTone(freq, duration, waveform = 'square', envelope = null, busNode = null, volume = 0.3, startTime = null) {
    if (!this.ctx) return null;

    const bus = busNode || this.sfxGain;
    const now = startTime != null ? startTime : this.ctx.currentTime;
    const env = envelope || { attack: 0.01, decay: 0.05, sustain: 0.6, release: 0.05 };

    // Per-voice gain for envelope
    const gainNode = this.ctx.createGain();
    gainNode.connect(bus);
    gainNode.gain.setValueAtTime(0, now);

    // ADSR
    const attackEnd = now + env.attack;
    const decayEnd = attackEnd + env.decay;
    const sustainLevel = env.sustain * volume;
    const releaseStart = now + duration - env.release;
    const releaseEnd = now + duration;

    gainNode.gain.linearRampToValueAtTime(volume, attackEnd);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, decayEnd);
    gainNode.gain.setValueAtTime(sustainLevel, Math.max(decayEnd, releaseStart));
    gainNode.gain.linearRampToValueAtTime(0, releaseEnd);

    // Oscillator
    const osc = this.ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(releaseEnd + 0.01);

    return { osc, gain: gainNode };
  }

  /**
   * Play a frequency sweep (portamento).
   * @param {number} startFreq
   * @param {number} endFreq
   * @param {number} duration
   * @param {string} waveform
   * @param {object} [envelope]
   * @param {GainNode} [busNode]
   * @param {number} [volume=0.3]
   * @returns {{ osc: OscillatorNode, gain: GainNode }}
   */
  playSweep(startFreq, endFreq, duration, waveform = 'square', envelope = null, busNode = null, volume = 0.3) {
    const result = this.playTone(startFreq, duration, waveform, envelope, busNode, volume);
    if (!result) return null;
    const now = this.ctx.currentTime;
    result.osc.frequency.linearRampToValueAtTime(endFreq, now + duration);
    return result;
  }

  /**
   * Play white noise with ADSR envelope.
   * @param {number} duration
   * @param {object} [envelope]
   * @param {GainNode} [busNode]
   * @param {number} [volume=0.2]
   * @returns {{ source: AudioBufferSourceNode, gain: GainNode }}
   */
  playNoise(duration, envelope = null, busNode = null, volume = 0.2) {
    if (!this.ctx || !this._noiseBuffer) return null;

    const bus = busNode || this.sfxGain;
    const now = this.ctx.currentTime;
    const env = envelope || { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.05 };

    const gainNode = this.ctx.createGain();
    gainNode.connect(bus);
    gainNode.gain.setValueAtTime(0, now);

    // ADSR
    const attackEnd = now + env.attack;
    const decayEnd = attackEnd + env.decay;
    const sustainLevel = env.sustain * volume;
    const releaseStart = now + duration - env.release;
    const releaseEnd = now + duration;

    gainNode.gain.linearRampToValueAtTime(volume, attackEnd);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, decayEnd);
    gainNode.gain.setValueAtTime(sustainLevel, Math.max(decayEnd, releaseStart));
    gainNode.gain.linearRampToValueAtTime(0, releaseEnd);

    const source = this.ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.connect(gainNode);
    source.start(now);
    source.stop(releaseEnd + 0.01);

    return { source, gain: gainNode };
  }

  /**
   * Schedule a note for music playback (absolute time).
   * @param {number} freq
   * @param {number} startTime - AudioContext time
   * @param {number} duration
   * @param {string} waveform
   * @param {object} [envelope]
   * @param {number} [volume=0.15]
   * @returns {{ osc: OscillatorNode, gain: GainNode }}
   */
  scheduleNote(freq, startTime, duration, waveform = 'square', envelope = null, volume = 0.15) {
    return this.playTone(freq, duration, waveform, envelope, this.musicGain, volume, startTime);
  }

  /**
   * Schedule a noise hit for music playback (percussion).
   * @param {number} startTime
   * @param {number} duration
   * @param {number} [volume=0.1]
   * @returns {{ source: AudioBufferSourceNode, gain: GainNode }}
   */
  scheduleNoise(startTime, duration, volume = 0.1) {
    if (!this.ctx || !this._noiseBuffer) return null;

    const gainNode = this.ctx.createGain();
    gainNode.connect(this.musicGain);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.005);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    const source = this.ctx.createBufferSource();
    source.buffer = this._noiseBuffer;
    source.connect(gainNode);
    source.start(startTime);
    source.stop(startTime + duration + 0.01);

    return { source, gain: gainNode };
  }

  // Volume controls
  setMasterVolume(v) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime);
    }
  }

  setSFXVolume(v) {
    if (this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime);
    }
  }

  setMusicVolume(v) {
    if (this.musicGain) {
      this.musicGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime);
    }
  }

  /** Get the current AudioContext time. */
  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}
