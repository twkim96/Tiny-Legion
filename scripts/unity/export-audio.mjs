import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AUDIO_CUES } from '../../dist/src/audio.js';

// Render the maintained Web Audio frequency/envelope definitions once at export time.
export function renderCueWav(cue, sampleRate = 44100) {
  const count = Math.round(cue.durationSeconds * sampleRate), bytes = count * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(bytes, 40);
  const rate = Math.log(cue.to / cue.from) / cue.frequencyRampSeconds;
  const rampCycles = rate === 0 ? cue.from * cue.frequencyRampSeconds
    : cue.from * Math.expm1(rate * cue.frequencyRampSeconds) / rate;
  for (let index = 0; index < count; index++) {
    const t = index / sampleRate, rampTime = Math.min(t, cue.frequencyRampSeconds);
    const cycles = t <= cue.frequencyRampSeconds
      ? (rate === 0 ? cue.from * t : cue.from * Math.expm1(rate * rampTime) / rate)
      : rampCycles + cue.to * (t - cue.frequencyRampSeconds);
    const gain = cue.gain * Math.pow(cue.endGain / cue.gain, Math.min(t / cue.gainRampSeconds, 1));
    wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * cycles) * gain * 32767), 44 + index * 2);
  }
  return wav;
}

export async function exportAudio(root) {
  const target = resolve(root, 'unity/Assets/TinyLegion/Resources/Sounds');
  await mkdir(target, { recursive: true });
  for (const [id, cue] of Object.entries(AUDIO_CUES)) await writeFile(resolve(target, `${id}.wav`), renderCueWav(cue));
}
