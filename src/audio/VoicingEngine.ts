import { midiToFreq, dbToGain } from './utils';

export class VoicingEngine {
  private ctx: AudioContext;
  private dest: AudioNode;
  private activeNodes: AudioNode[] = [];

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
  }

  /**
   * Play a piano-like tone with variable hammer hardness.
   * @param midiNote MIDI note number (e.g., 60 = C4)
   * @param hardness 0-100 (soft to hard)
   * @param velocity 0-100 (pp to ff)
   */
  play(midiNote: number, hardness: number, velocity: number): void {
    this.stop();

    const now = this.ctx.currentTime;
    const baseFreq = midiToFreq(midiNote);
    const velGain = 0.1 + (velocity / 100) * 0.9;
    const harmonicCount = 8;

    // Envelope timings
    const attack = 0.005;
    const decay = 0.1 + (1 - hardness / 100) * 0.2;
    const sustain = 0.2 + (1 - hardness / 100) * 0.2;
    const release = 0.3 + (1 - hardness / 100) * 0.4;
    const totalDuration = attack + decay + 0.5 + release;

    for (let h = 1; h <= harmonicCount; h++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * h;

      // Harmonic gain based on hardness
      let harmonicDb: number;
      if (hardness <= 50) {
        // Soft: natural rolloff enhanced
        const softFactor = 1 - hardness / 50; // 1 at 0, 0 at 50
        harmonicDb = -6 * Math.log2(h) - softFactor * 20 * Math.log2(Math.max(h, 1));
      } else {
        // Hard: boost high harmonics
        const hardFactor = (hardness - 50) / 50; // 0 at 50, 1 at 100
        harmonicDb = -6 * Math.log2(h) + hardFactor * 6 * Math.log2(Math.max(h, 1));
      }

      const harmonicGain = dbToGain(Math.max(harmonicDb, -60));

      const g = this.ctx.createGain();
      const peakGain = harmonicGain * velGain * 0.35;

      // ADSR envelope
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peakGain, now + attack);
      g.gain.exponentialRampToValueAtTime(
        peakGain * sustain,
        now + attack + decay,
      );
      g.gain.setValueAtTime(peakGain * sustain, now + totalDuration - release);
      g.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);

      osc.connect(g);
      g.connect(this.dest);

      osc.start(now);
      osc.stop(now + totalDuration + 0.05);

      this.activeNodes.push(osc, g);
    }
  }

  stop(): void {
    this.activeNodes.forEach((n) => {
      try {
        if (n instanceof AudioScheduledSourceNode) n.stop();
        n.disconnect();
      } catch { /* already stopped */ }
    });
    this.activeNodes = [];
  }

  dispose(): void {
    this.stop();
  }
}
