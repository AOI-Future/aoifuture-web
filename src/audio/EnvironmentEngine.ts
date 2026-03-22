export type HearingProfile = '健聴' | '聴覚過敏' | '加齢性難聴' | '高音難聴';
export type Environment = 'スーパー' | '教室' | 'コンサートホール' | '静かな部屋';
export type Intervention = 'ノイズキャンセリング' | 'クワイエットアワー' | '補聴器';

interface EnvLayer {
  type: OscillatorType | 'noise';
  freq: number;
  gain: number;
  label: string;
}

const ENV_LAYERS: Record<Environment, EnvLayer[]> = {
  スーパー: [
    { type: 'sine', freq: 80, gain: 0.15, label: 'BGM低音' },
    { type: 'square', freq: 2800, gain: 0.08, label: 'レジビープ' },
    { type: 'noise', freq: 0, gain: 0.1, label: '空調' },
  ],
  教室: [
    { type: 'sawtooth', freq: 200, gain: 0.1, label: '子供の声' },
    { type: 'sine', freq: 1200, gain: 0.06, label: 'チャイム' },
    { type: 'noise', freq: 0, gain: 0.05, label: '環境ノイズ' },
  ],
  コンサートホール: [
    { type: 'sine', freq: 220, gain: 0.12, label: 'A弦' },
    { type: 'sine', freq: 330, gain: 0.08, label: 'E弦' },
    { type: 'sine', freq: 440, gain: 0.06, label: 'A音' },
  ],
  静かな部屋: [
    { type: 'noise', freq: 0, gain: 0.02, label: '環境ノイズ' },
  ],
};

export class EnvironmentEngine {
  private ctx: AudioContext;
  private dest: AudioNode;

  // Audio graph nodes
  private sourceNodes: AudioScheduledSourceNode[] = [];
  private sourceGains: GainNode[] = [];
  private profileFilter: BiquadFilterNode | null = null;
  private profileGain: GainNode | null = null;
  private interventionFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private playing = false;
  private currentEnv: Environment = 'スーパー';
  private noiseBuffer: AudioBuffer | null = null;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Start or restart environment sound */
  start(
    env: Environment,
    profile: HearingProfile,
    interventions: Set<Intervention>,
  ): void {
    this.stop();
    this.currentEnv = env;
    this.playing = true;

    const now = this.ctx.currentTime;

    // Create processing chain: sources → profileFilter → profileGain → interventionFilter → masterGain → dest
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.gain.linearRampToValueAtTime(0.9, now + 0.3);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.dest);

    // Intervention filter
    this.interventionFilter = this.ctx.createBiquadFilter();
    this.interventionFilter.type = 'highpass';
    this.interventionFilter.frequency.value = 20;
    this.interventionFilter.connect(this.masterGain);

    // Profile filter + gain
    this.profileGain = this.ctx.createGain();
    this.profileGain.gain.value = 1;

    this.profileFilter = this.ctx.createBiquadFilter();
    this.profileFilter.connect(this.profileGain);
    this.profileGain.connect(this.interventionFilter);

    // Apply profile
    this.applyProfile(profile);
    // Apply interventions
    this.applyInterventions(interventions, env);

    // Create source layers
    const layers = ENV_LAYERS[env];
    layers.forEach((layer) => {
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = layer.gain;
      gainNode.connect(this.profileFilter!);
      this.sourceGains.push(gainNode);

      if (layer.type === 'noise') {
        if (!this.noiseBuffer) {
          // Create 2s noise buffer for looping
          const sr = this.ctx.sampleRate;
          const len = sr * 2;
          this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
          const data = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;

        // Low-pass for air conditioning sound
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 800;
        src.connect(lp);
        lp.connect(gainNode);

        src.start(now);
        this.sourceNodes.push(src);
      } else {
        const osc = this.ctx.createOscillator();
        osc.type = layer.type;
        osc.frequency.value = layer.freq;
        osc.connect(gainNode);
        osc.start(now);
        this.sourceNodes.push(osc);
      }
    });
  }

  applyProfile(profile: HearingProfile): void {
    if (!this.profileFilter || !this.profileGain) return;

    switch (profile) {
      case '健聴':
        this.profileFilter.type = 'allpass';
        this.profileFilter.frequency.value = 1000;
        this.profileGain.gain.value = 1;
        break;
      case '聴覚過敏':
        this.profileFilter.type = 'peaking';
        this.profileFilter.frequency.value = 3000;
        this.profileFilter.Q.value = 1;
        this.profileFilter.gain.value = 15;
        this.profileGain.gain.value = 1.5;
        break;
      case '加齢性難聴':
        this.profileFilter.type = 'lowpass';
        this.profileFilter.frequency.value = 3000;
        this.profileFilter.Q.value = 0.7;
        this.profileGain.gain.value = 0.6;
        break;
      case '高音難聴':
        this.profileFilter.type = 'lowpass';
        this.profileFilter.frequency.value = 2000;
        this.profileFilter.Q.value = 1;
        this.profileGain.gain.value = 0.5;
        break;
    }
  }

  applyInterventions(
    interventions: Set<Intervention>,
    env?: Environment,
  ): void {
    const currentEnv = env || this.currentEnv;

    if (!this.interventionFilter || !this.masterGain) return;

    // Noise cancelling: highpass to remove low-freq noise
    if (interventions.has('ノイズキャンセリング')) {
      this.interventionFilter.type = 'highpass';
      this.interventionFilter.frequency.value = 200;
      this.interventionFilter.Q.value = 0.7;
    } else {
      this.interventionFilter.type = 'highpass';
      this.interventionFilter.frequency.value = 20;
    }

    // Quiet hour: reduce overall volume
    if (interventions.has('クワイエットアワー')) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(0.15, now, 0.1);
      // Also mute specific layers (BGM, beeps)
      const layers = ENV_LAYERS[currentEnv];
      this.sourceGains.forEach((g, i) => {
        if (layers[i] && (layers[i].label === 'BGM低音' || layers[i].label === 'レジビープ')) {
          g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }
      });
    }

    // Hearing aid: boost gain (but not if hypersensitive)
    if (interventions.has('補聴器')) {
      this.profileGain!.gain.value = Math.min(this.profileGain!.gain.value * 1.5, 2);
    }
  }

  /** Get frequency data for spectrum visualization */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  stop(): void {
    const now = this.ctx.currentTime;

    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, now, 0.1);
    }

    // Stop sources after fade
    setTimeout(() => {
      this.sourceNodes.forEach((n) => {
        try { n.stop(); n.disconnect(); } catch {}
      });
      this.sourceGains.forEach((n) => {
        try { n.disconnect(); } catch {}
      });
      try { this.profileFilter?.disconnect(); } catch {}
      try { this.profileGain?.disconnect(); } catch {}
      try { this.interventionFilter?.disconnect(); } catch {}
      try { this.masterGain?.disconnect(); } catch {}
      try { this.analyser?.disconnect(); } catch {}

      this.sourceNodes = [];
      this.sourceGains = [];
      this.profileFilter = null;
      this.profileGain = null;
      this.interventionFilter = null;
      this.masterGain = null;
      this.analyser = null;
      this.playing = false;
    }, 200);
  }

  dispose(): void {
    this.stop();
    this.noiseBuffer = null;
  }
}
