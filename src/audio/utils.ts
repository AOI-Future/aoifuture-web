/** Convert linear gain to decibels */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(gain, 1e-10));
}

/** Convert decibels to linear gain */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** MIDI note number to frequency */
export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Note name to MIDI number (e.g., "C4" -> 60) */
export function noteToMidi(name: string): number {
  const noteMap: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  const match = name.match(/^([A-G])(\d)$/);
  if (!match) return 60;
  return (parseInt(match[2]) + 1) * 12 + noteMap[match[1]];
}

/** Generate white noise AudioBuffer */
export function createNoiseBuffer(
  ctx: AudioContext,
  duration: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Generate exponential decay impulse response for reverb */
export function createIR(
  ctx: AudioContext,
  t60: number,
  wetness: number = 1,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * Math.min(t60, 6));
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const decay = -6.908 / t60; // ln(0.001) / t60

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(decay * t) * wetness;
    }
  }
  return buffer;
}
