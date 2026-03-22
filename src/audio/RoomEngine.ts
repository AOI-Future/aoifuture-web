import { createIR, createNoiseBuffer } from './utils';

export type WallMaterial = 'コンクリート' | '木' | 'カーペット' | '吸音パネル';
export type RoomSource = 'クラップ' | 'ピアノ' | '声';

const ABSORPTION: Record<WallMaterial, number> = {
  コンクリート: 0.02,
  木: 0.10,
  カーペット: 0.30,
  吸音パネル: 0.80,
};

/**
 * Calculate T60 reverb time using Sabine's formula.
 * T60 = 0.161 * V / (S * α)
 * Surface area S approximated as 6 * V^(2/3) (cube)
 */
function calcT60(volume: number, alpha: number): number {
  const surface = 6 * Math.pow(volume, 2 / 3);
  const t60 = (0.161 * volume) / (surface * alpha);
  return Math.min(Math.max(t60, 0.1), 10);
}

export class RoomEngine {
  private ctx: AudioContext;
  private dest: AudioNode;
  private convolver: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];

  // Precomputed IR cache
  private irCache = new Map<string, AudioBuffer>();

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
  }

  /** Precompute IRs for a given wall material at 3 volumes */
  precomputeIRs(material: WallMaterial): void {
    const alpha = ABSORPTION[material];
    const volumes = [50, 500, 5000];
    for (const v of volumes) {
      const key = `${material}-${v}`;
      if (!this.irCache.has(key)) {
        const t60 = calcT60(v, alpha);
        this.irCache.set(key, createIR(this.ctx, t60));
      }
    }
  }

  /** Get or create IR for given parameters */
  private getIR(material: WallMaterial, volume: number): AudioBuffer {
    const alpha = ABSORPTION[material];
    const t60 = calcT60(volume, alpha);
    // Use exact T60 for fresh generation (debounced from caller)
    return createIR(this.ctx, t60);
  }

  /** Set up convolver with material and volume */
  setupRoom(material: WallMaterial, volume: number): void {
    // Clean up previous convolver chain
    if (this.convolver) {
      try { this.convolver.disconnect(); } catch {}
    }
    if (this.dryGain) {
      try { this.dryGain.disconnect(); } catch {}
    }
    if (this.wetGain) {
      try { this.wetGain.disconnect(); } catch {}
    }

    const ir = this.getIR(material, volume);

    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = ir;

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0;
    this.dryGain.connect(this.dest);

    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.value = 0.8;

    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.dest);
  }

  /** Play a source sound through the room */
  play(source: RoomSource): void {
    this.stopSource();

    if (!this.convolver || !this.dryGain) return;

    const now = this.ctx.currentTime;

    if (source === 'クラップ') {
      const buf = createNoiseBuffer(this.ctx, 0.01);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(1.5, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      src.connect(g);
      g.connect(this.dryGain);
      g.connect(this.convolver);

      src.start(now);
      src.stop(now + 0.1);
      this.activeNodes.push(src, g);
    } else if (source === 'ピアノ') {
      // Simple piano tone: C4 with a few harmonics
      const baseFreq = 261.63;
      for (let h = 1; h <= 4; h++) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = baseFreq * h;

        const g = this.ctx.createGain();
        const gain = 0.35 / h;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc.connect(g);
        g.connect(this.dryGain!);
        g.connect(this.convolver!);

        osc.start(now);
        osc.stop(now + 2);
        this.activeNodes.push(osc, g);
      }
    } else {
      // Voice: simple formant (あ)
      const baseFreq = 120;
      const formants = [800, 1200, 2500];
      const gains = [0.8, 0.4, 0.2];

      formants.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = baseFreq;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq;
        bp.Q.value = 10;

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gains[i], now + 0.05);
        g.gain.setValueAtTime(gains[i], now + 0.3);
        g.gain.linearRampToValueAtTime(0, now + 0.5);

        osc.connect(bp);
        bp.connect(g);
        g.connect(this.dryGain!);
        g.connect(this.convolver!);

        osc.start(now);
        osc.stop(now + 0.6);
        this.activeNodes.push(osc, bp, g);
      });
    }
  }

  getT60(material: WallMaterial, volume: number): number {
    return calcT60(volume, ABSORPTION[material]);
  }

  private stopSource(): void {
    this.activeNodes.forEach((n) => {
      try {
        if (n instanceof AudioScheduledSourceNode) n.stop();
        n.disconnect();
      } catch {}
    });
    this.activeNodes = [];
  }

  dispose(): void {
    this.stopSource();
    try { this.convolver?.disconnect(); } catch {}
    try { this.dryGain?.disconnect(); } catch {}
    try { this.wetGain?.disconnect(); } catch {}
    this.irCache.clear();
  }
}
