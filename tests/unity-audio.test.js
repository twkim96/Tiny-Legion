import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Unity effect clips are valid bounded mono PCM with rising victory and falling summon tones', async () => {
  const waves = {};
  for (const cue of ['tap', 'summon', 'win']) {
    const wav = await readFile(new URL(`../unity/Assets/TinyLegion/Resources/Sounds/${cue}.wav`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ');
    assert.equal(wav.readUInt16LE(20), 1); // PCM
    assert.equal(wav.readUInt16LE(22), 1); // Mono
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.readUInt32LE(40), wav.length - 44);
    const rate = wav.readUInt32LE(24);
    const samples = Array.from({ length: (wav.length - 44) / 2 }, (_,i) => wav.readInt16LE(44 + i * 2));
    assert.ok(samples.length / rate > .14 && samples.length / rate < .16);
    assert.ok(Math.max(...samples.map(Math.abs)) < 2500);
    assert.ok(Math.max(...samples.slice(-300).map(Math.abs)) < 5);
    waves[cue] = { samples, rate };
  }
  function frequency(wave, from, to) {
    const { samples, rate } = wave;
    let crossings = 0;
    for (let i = Math.ceil(from * rate); i < Math.floor(to * rate); i++) if (samples[i - 1] <= 0 && samples[i] > 0) crossings++;
    return crossings / (to - from);
  }
  assert.ok(frequency(waves.win, .001, .031) < frequency(waves.win, .06, .09));
  assert.ok(frequency(waves.summon, .001, .031) > frequency(waves.summon, .06, .09));
  assert.ok(frequency(waves.tap, .001, .031) > frequency(waves.summon, .001, .031));
});
