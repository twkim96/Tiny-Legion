import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio, normalizeAudioSettings, stageMusic } from '../dist/src/audio.js';
import { newAccount, normalizeAccount } from '../dist/src/account.js';

function harness() {
  const played = [], tones = [], frequencies = [];
  const player = { paused: true, pause() { this.paused = true; }, load() {}, play() { this.paused = false; played.push(this.src); return Promise.resolve(); } };
  const context = { currentTime: 1, resume: () => Promise.resolve(), suspend: () => Promise.resolve(), destination: {},
    createOscillator: () => ({ frequency: { setValueAtTime(value) { frequencies.push(value); }, exponentialRampToValueAtTime(value) { frequencies.push(value); } }, connect() {}, start() { tones.push('start'); }, stop() {} }),
    createGain: () => ({ gain: { setValueAtTime(value) { tones.push(value); }, exponentialRampToValueAtTime() {} }, connect() {} }) };
  return { player, played, tones, frequencies, context, audio: new GameAudio({ createPlayer: () => player, createContext: () => context }) };
}
test('music waits for input, loops the stage track, and pauses while hidden', async () => {
  const h = harness(); h.audio.configure({}, 1); assert.equal(h.played.length, 0);
  h.audio.unlock(); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.player.loop, true); assert.equal(h.played[0], '/assets/music/meadow.mp3');
  h.audio.configure({}, 5); assert.equal(h.player.src, '/assets/music/boss.mp3');
  h.audio.configure({}, 5, false); assert.equal(h.player.paused, true);
  await Promise.resolve(); await Promise.resolve();
  h.audio.configure({}, 11, true); assert.equal(h.player.src, '/assets/music/workshop.mp3'); assert.equal(h.player.paused, false);
});

test('music and effect mute and volume are independent and persist', () => {
  const h = harness(), settings = { musicEnabled: false, sfxEnabled: true, musicVolume: 0.5, sfxVolume: 0.2 };
  h.audio.configure(settings, 1); h.audio.unlock(); h.audio.chirp('summon');
  assert.equal(h.played.length, 0); assert.ok(h.tones.includes(0.036));
  h.audio.configure({ ...settings, musicEnabled: true, sfxEnabled: false }, 1); h.audio.chirp();
  assert.equal(h.played.length, 1); assert.equal(h.player.volume, 0.5); assert.equal(h.tones.filter(t => t === 'start').length, 1);
  const a = newAccount(); a.settings.audio = settings;
  assert.deepEqual(normalizeAccount(a).settings.audio, settings);
});
test('volume validation clamps saves and blocked playback waits for the next input', async () => {
  assert.deepEqual(normalizeAudioSettings({musicVolume: 4, sfxVolume: -2, musicEnabled: 'yes'}), {musicEnabled:true,sfxEnabled:true,musicVolume:1,sfxVolume:0});
  const h = harness(); let attempts = 0;
  h.player.play = () => { attempts++; return Promise.reject(new Error('autoplay')); };
  h.audio.configure({}, 1); h.audio.unlock(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  h.audio.configure({}, 1); h.audio.configure({}, 1); assert.equal(attempts, 1);
  h.audio.unlock(); assert.equal(attempts, 2); await Promise.resolve(); await Promise.resolve();
  assert.equal(stageMusic(0), 'journey'); assert.equal(stageMusic(20), 'boss');
});

test('a suspended SFX context schedules the short tone after resume and skips it if hidden meanwhile', async () => {
  const h=harness();let resume;
  h.context.state='suspended';h.context.resume=()=>new Promise(resolve=>{resume=resolve;});
  h.audio.unlock();h.audio.chirp('summon');
  assert.equal(h.tones.length,0);
  h.context.currentTime=20;h.context.state='running';resume();await Promise.resolve();
  assert.equal(h.tones.filter(t=>t==='start').length,1);
  h.context.state='suspended';h.audio.chirp();h.audio.stop();resume();await Promise.resolve();
  assert.equal(h.tones.filter(t=>t==='start').length,1);
});


test('tap, summon and victory retain distinct tones and unknown cues use tap', () => {
  const h = harness(); h.audio.unlock();
  for (const cue of ['tap','summon','win','unknown','constructor']) h.audio.chirp(cue);
  assert.deepEqual(h.frequencies,[720,440,600,440,880,1100,720,440,720,440]);
});
