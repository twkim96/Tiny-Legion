export const AUDIO_DEFAULTS = Object.freeze({ musicEnabled: true, sfxEnabled: true, musicVolume: 0.3, sfxVolume: 0.6 });
export function normalizeAudioSettings(value = {}) {
  const volume = (key) => typeof value?.[key] === 'number' && Number.isFinite(value[key])
    ? Math.max(0, Math.min(1, value[key])) : AUDIO_DEFAULTS[key];
  return { musicEnabled: typeof value?.musicEnabled === 'boolean' ? value.musicEnabled : AUDIO_DEFAULTS.musicEnabled,
    sfxEnabled: typeof value?.sfxEnabled === 'boolean' ? value.sfxEnabled : AUDIO_DEFAULTS.sfxEnabled,
    musicVolume: volume('musicVolume'), sfxVolume: volume('sfxVolume') };
}
