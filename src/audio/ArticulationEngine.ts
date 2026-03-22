import { createNoiseBuffer } from './utils';

/** Japanese vowel formant frequencies (F1, F2, F3) in Hz */
const FORMANTS: Record<string, [number, number, number]> = {
  あ: [800, 1200, 2500],
  い: [300, 2300, 3000],
  う: [350, 1100, 2400],
  え: [500, 1900, 2600],
  お: [500, 900, 2500],
};

export type Place = '両唇' | '歯茎' | '軟口蓋' | '声門';
export type Manner = '破裂' | '摩擦' | '鼻' | '接近';
export type Vowel = 'あ' | 'い' | 'う' | 'え' | 'お';

/** Consonant noise filter frequencies by place */
const PLACE_FREQ: Record<Place, number> = {
  両唇: 500,
  歯茎: 4000,
  軟口蓋: 2000,
  声門: 1000,
};

/** Consonant noise characteristics by manner */
const MANNER_CONFIG: Record<Manner, { duration: number; noiseGain: number; q: number }> = {
  破裂: { duration: 0.02, noiseGain: 0.8, q: 5 },
  摩擦: { duration: 0.12, noiseGain: 0.4, q: 2 },
  鼻:   { duration: 0.08, noiseGain: 0.1, q: 1 },
  接近: { duration: 0.06, noiseGain: 0.15, q: 1 },
};

export class ArticulationEngine {
  private ctx: AudioContext;
  private dest: AudioNode;
  private activeNodes: AudioNode[] = [];

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
  }

  play(place: Place, manner: Manner, vowel: Vowel, voiced: boolean): void {
    this.stop();

    const now = this.ctx.currentTime;
    const consonantConfig = MANNER_CONFIG[manner];
    const consonantEnd = now + consonantConfig.duration;
    const vowelDuration = 0.3;

    // --- Consonant: filtered noise burst ---
    const noiseBuffer = createNoiseBuffer(this.ctx, consonantConfig.duration + 0.01);
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = PLACE_FREQ[place];
    noiseFilter.Q.value = consonantConfig.q;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(consonantConfig.noiseGain * 1.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, consonantEnd);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.dest);

    noiseSrc.start(now);
    noiseSrc.stop(consonantEnd + 0.01);

    this.activeNodes.push(noiseSrc, noiseFilter, noiseGain);

    // --- Vowel: formant synthesis (3 bandpass-filtered oscillators) ---
    const [f1, f2, f3] = FORMANTS[vowel];
    const formants = [f1, f2, f3];
    const gains = [1.0, 0.5, 0.3];
    const baseFreq = voiced ? 120 : 200;

    formants.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = voiced ? 'sawtooth' : 'triangle';
      osc.frequency.value = baseFreq;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 10;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gains[i], consonantEnd + 0.02);
      g.gain.setValueAtTime(gains[i], consonantEnd + vowelDuration - 0.05);
      g.gain.linearRampToValueAtTime(0, consonantEnd + vowelDuration);

      osc.connect(bp);
      bp.connect(g);
      g.connect(this.dest);

      osc.start(consonantEnd - 0.01);
      osc.stop(consonantEnd + vowelDuration + 0.01);

      this.activeNodes.push(osc, bp, g);
    });
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
