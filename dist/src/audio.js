export const AUDIO_DEFAULTS = Object.freeze({ musicEnabled: true, sfxEnabled: true, musicVolume: 0.3, sfxVolume: 0.6 });
export function normalizeAudioSettings(value = {}) {
  const volume = (key) => typeof value?.[key] === 'number' && Number.isFinite(value[key])
    ? Math.max(0, Math.min(1, value[key])) : AUDIO_DEFAULTS[key];
  return { musicEnabled: typeof value?.musicEnabled === 'boolean' ? value.musicEnabled : AUDIO_DEFAULTS.musicEnabled,
    sfxEnabled: typeof value?.sfxEnabled === 'boolean' ? value.sfxEnabled : AUDIO_DEFAULTS.sfxEnabled,
    musicVolume: volume('musicVolume'), sfxVolume: volume('sfxVolume') };
}
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
      this.context ??= this.createContext(); this.context.resume()?.catch(() => {});
      const oscillator = this.context.createOscillator(), gain = this.context.createGain(), t = this.context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'win' ? 660 : type === 'summon' ? 360 : 440, t);
      oscillator.frequency.exponentialRampToValueAtTime(type === 'win' ? 880 : 250, t + 0.09);
      gain.gain.setValueAtTime(0.06 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      oscillator.connect(gain); gain.connect(this.context.destination); oscillator.start(t); oscillator.stop(t + 0.15);
    } catch {}
  }
  stop() { this.visible = false; this.player?.pause(); void this.context?.suspend()?.catch(() => {}); }
}
