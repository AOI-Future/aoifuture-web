import type { Surface } from './geography';
/** Original procedural score and effects; no audio downloads or third-party recordings. */
export class Soundscape {
  ctx?: AudioContext;
  master?: GainNode;
  wet?: GainNode;
  muted = false;
  volume = .45;
  nextNote = 0;
  note = 0;
  async start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -14; limiter.ratio.value = 8;
      this.master.connect(limiter); limiter.connect(ctx.destination);
      const reverb = ctx.createConvolver(); const impulse = ctx.createBuffer(2, ctx.sampleRate * 2.6, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      }
      reverb.buffer = impulse; this.wet = ctx.createGain(); this.wet.gain.value = .3;
      this.wet.connect(reverb); reverb.connect(this.master);
      for (const frequency of [55, 110.15, 164.81]) {
        const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = frequency;
        gain.gain.value = .022; osc.connect(gain); gain.connect(this.master); osc.start();
      }
    }
    await this.ctx.resume(); this.setVolume(this.volume); this.nextNote = this.ctx.currentTime + .1;
  }
  setVolume(value: number) { this.volume = value; this.master?.gain.setTargetAtTime(this.muted ? 0 : value, this.ctx!.currentTime, .08); }
  toggle() { this.muted = !this.muted; this.setVolume(this.volume); }
  tone(frequency: number, duration: number, level: number, type: OscillatorType = 'sine') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, t); gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + .025); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(gain); gain.connect(this.master!); gain.connect(this.wet!); osc.start(t); osc.stop(t + duration + .02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  tick(theme: number, proximity: number) {
    if (!this.ctx || this.ctx.state !== 'running' || this.ctx.currentTime < this.nextNote) return;
    const scale = [220, 261.63, 329.63, 392, 440, 523.25, 659.25, 392];
    this.tone(scale[this.note++ % scale.length] * [1, .75, 1.125][theme % 3], 3.8, .035);
    if (proximity > .7) this.tone(880, .7, .015 * proximity);
    this.nextNote = this.ctx.currentTime + 1.6;
  }
  space(echo: number) { if(this.ctx && this.wet) this.wet.gain.setTargetAtTime(echo,this.ctx.currentTime,.6); }
  step(surface: Surface) {
    const profile = {carpet:[65,.1,.045],tile:[180,.23,.055],stone:[110,.19,.065],concrete:[85,.14,.06]}[surface];
    this.tone(profile[0]+Math.random()*20,profile[1],profile[2],'triangle');
  }
  collect() { [440, 554.37, 659.25, 880].forEach(f => this.tone(f, 2.8, .065)); }
  pause() { void this.ctx?.suspend().catch(() => {}); }
  dispose() { void this.ctx?.close().catch(() => {}); }
}
