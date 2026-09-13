// One reusable audio graph for driving; short, capped voices for game events.
export class GameAudio {
  constructor() {
    this.enabled = true;
    this.voices = new Set();
    this.lastUpdate = -Infinity;
    try { this.enabled = localStorage.getItem('zer0lane_sound') !== 'off'; } catch {}
  }

  async unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) this.init();
      await this.ctx.resume();
    } catch { this.enabled = false; }
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motorGain.connect(this.master);
    this.motor = ctx.createOscillator();
    this.motor.type = 'triangle';
    this.motor.frequency.value = 55;
    this.motor.connect(this.motorGain);
    this.motor.start();

    // Generate noise once, then reuse it for tyres and impacts. No audio downloads.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this.tyres = ctx.createBufferSource();
    this.tyres.buffer = this.noise;
    this.tyres.loop = true;
    this.tyreFilter = ctx.createBiquadFilter();
    this.tyreFilter.type = 'bandpass';
    this.tyreFilter.frequency.value = 1100;
    this.tyreFilter.Q.value = 0.7;
    this.tyreGain = ctx.createGain();
    this.tyreGain.gain.value = 0;
    this.tyres.connect(this.tyreFilter);
    this.tyreFilter.connect(this.tyreGain);
    this.tyreGain.connect(this.master);
    this.tyres.start();
  }

  async toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stop();
    else await this.unlock();
    try { localStorage.setItem('zer0lane_sound', this.enabled ? 'on' : 'off'); } catch {}
  }

  update(run, input) {
    if (!this.enabled || this.ctx?.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Audio runs on its own clock. Update pitch at 20 Hz, not every physics step.
    if (now - this.lastUpdate < 0.05) return;
    this.lastUpdate = now;
    this.motor.frequency.setTargetAtTime(48 + run.speed * 0.23 + (run.boosting ? 24 : 0), now, 0.08);
    this.motorGain.gain.setTargetAtTime(0.06 + Math.min(run.speed / 600, 1) * 0.05, now, 0.04);
    const turning = input.left !== input.right;
    this.tyreGain.gain.setTargetAtTime(turning ? 0.055 : input.brake ? 0.03 : 0.006, now, 0.05);
    this.tyreFilter.frequency.setTargetAtTime(run.boosting ? 1800 : 900, now, 0.08);
  }

  stop(clearEffects = true) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const gain of [this.motorGain, this.tyreGain]) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.015);
    }
    this.lastUpdate = -Infinity;
    if (clearEffects) for (const voice of [...this.voices]) voice.cancel();
  }

  effect(kind) {
    if (!this.enabled || this.ctx?.state !== 'running') return;
    if (kind === 'hit') {
      this.voice('noise', 1, 0.38, 0.4);
      this.voice('sine', 125, 0.32, 0.24, 0, 28);
    } else if (kind === 'charge') {
      [660, 880, 1320].forEach((frequency, index) => this.voice('sine', frequency, 0.17, 0.13, index * 0.065));
    } else if (kind === 'near') {
      this.voice('sine', 880, 0.13, 0.09, 0, 1175);
    }
  }

  voice(type, frequency, duration, volume, delay = 0, endFrequency = frequency) {
    if (this.voices.size >= 10) return;
    const ctx = this.ctx, gain = ctx.createGain();
    const source = type === 'noise' ? ctx.createBufferSource() : ctx.createOscillator();
    const start = ctx.currentTime + delay;
    if (type === 'noise') source.buffer = this.noise;
    else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, start);
      source.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    }
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(gain); gain.connect(this.master);
    const voice = { cancel: () => { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(0, ctx.currentTime, 0.005); source.stop(ctx.currentTime + 0.025); } };
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(start); source.stop(start + duration + 0.03);
  }
}
