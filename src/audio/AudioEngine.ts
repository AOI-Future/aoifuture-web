/**
 * AudioEngine — manages shared AudioContext and master gain.
 * iOS Safari requires AudioContext creation inside a user gesture handler.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private _initialized = false;

  get context(): AudioContext {
    if (!this.ctx) throw new Error('AudioEngine not initialized');
    return this.ctx;
  }

  get master(): GainNode {
    if (!this.masterGain) throw new Error('AudioEngine not initialized');
    return this.masterGain;
  }

  get analyserNode(): AnalyserNode {
    if (!this.analyser) throw new Error('AudioEngine not initialized');
    return this.analyser;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  /** Must be called from a user gesture (click/tap) handler */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this._initialized = true;
  }

  setMasterVolume(value: number): void {
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, value)),
      this.context.currentTime,
      0.05,
    );
  }

  /** Resume suspended context (e.g., after tab switch) */
  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.analyser = null;
      this._initialized = false;
    }
  }
}
