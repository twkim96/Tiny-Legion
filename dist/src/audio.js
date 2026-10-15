import { normalizeAudioSettings } from "./audio-settings.js";
export { AUDIO_DEFAULTS, normalizeAudioSettings } from "./audio-settings.js";

export const AUDIO_CUES = Object.freeze(Object.fromEntries([
  ['tap', 720, 440], ['summon', 600, 440], ['win', 880, 1100],
].map(([id, from, to]) => [id, Object.freeze({ from, to, frequencyRampSeconds: 0.12,
  gain: 0.18, endGain: 0.0001, gainRampSeconds: 0.21, durationSeconds: 0.22 })])));
export function stageMusic(stageId) {
  if (stageId === 0) return 'journey';
  if (stageId % 5 === 0) return 'boss';
  return stageId > 10 ? 'workshop' : 'meadow';
}

// One music player and one SFX context, both unlocked only by user input.
export class GameAudio {
  constructor({ createPlayer = () => {
    const player = document.createElement('audio'); player.id = 'stage-music'; player.hidden = true;
    document.body.appendChild(player); return player;
  }, createContext = () => new (window.AudioContext || window.webkitAudioContext)() } = {}) {
    this.createPlayer = createPlayer; this.createContext = createContext;
    this.settings = normalizeAudioSettings(); this.unlocked = false; this.visible = true;
    this.track = null; this.player = null; this.context = null; this.playPending = false; this.blocked = false;
  }
  unlock() { this.unlocked = true; this.blocked = false; this.sync(); }
  configure(settings, stageId, visible = true) {
    this.settings = normalizeAudioSettings(settings); this.visible = visible;
    const track = stageMusic(stageId);
    if (this.track !== track) {
      this.track = track;
      if (this.player) { this.player.pause(); this.player.src = `/assets/music/${track}.mp3`; this.player.load(); }
    }
    this.sync();
  }
  sync() {
    const audible = this.unlocked && this.visible && this.settings.musicEnabled && this.settings.musicVolume > 0;
    if (audible && !this.player) {
      this.player = this.createPlayer(); this.player.loop = true; this.player.preload = 'none';
      this.player.src = `/assets/music/${this.track || 'journey'}.mp3`;
    }
    if (!this.player) return;
    this.player.volume = this.settings.musicVolume;
    if (audible && this.player.paused && !this.playPending && !this.blocked) {
      this.playPending = true;
      Promise.resolve(this.player.play()).catch(() => { this.blocked = true; }).finally(() => { this.playPending = false; });
    }
    if (!audible) this.player.pause();
  }
  chirp(type = 'tap') {
    if (!this.unlocked || !this.visible || !this.settings.sfxEnabled || this.settings.sfxVolume <= 0) return;
    try {
      this.context ??= this.createContext();
      if (this.context.state === 'suspended') {
        Promise.resolve(this.context.resume()).then(() => this.playTone(type)).catch(() => {});
        return;
      }
      this.playTone(type);
    } catch {}
  }
  playTone(type) {
    if (!this.unlocked || !this.visible || !this.settings.sfxEnabled || this.settings.sfxVolume <= 0 || this.context?.state === 'closed') return;
    try {
      const oscillator = this.context.createOscillator(), gain = this.context.createGain(), t = this.context.currentTime;
      const cue = Object.hasOwn(AUDIO_CUES, type) ? AUDIO_CUES[type] : AUDIO_CUES.tap;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(cue.from, t);
      oscillator.frequency.exponentialRampToValueAtTime(cue.to, t + cue.frequencyRampSeconds);
      gain.gain.setValueAtTime(cue.gain * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(cue.endGain, t + cue.gainRampSeconds);
      oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(t); oscillator.stop(t + cue.durationSeconds);
    } catch {}
  }
  stop() { this.visible = false; this.player?.pause(); void this.context?.suspend()?.catch(() => {}); }
}
