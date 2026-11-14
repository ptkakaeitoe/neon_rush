/**
 * Tiny chiptune engine built on the Web Audio API.
 * - Background music is synthesized live (no audio files, zero licensing issues).
 * - Sound effects are short synthesized blips.
 * Browsers only allow audio after a user gesture, so call `unlock()` from a click.
 */

export type Sfx =
  | "hover"
  | "click"
  | "move"
  | "ai"
  | "drop"
  | "win"
  | "lose"
  | "draw"
  | "coin"
  | "start";

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

// i–VI–III–VII in A minor (Am, F, C, G) — classic arcade feel
const CHORDS: number[][] = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
// Lead melody, one entry per 8th note across 4 bars (0 = rest)
const MELODY: number[] = [
  76, 0, 74, 72, 74, 0, 76, 79,
  77, 0, 76, 74, 72, 0, 69, 0,
  72, 0, 74, 76, 79, 0, 76, 74,
  74, 0, 71, 72, 74, 0, 0, 0,
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;

  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private readonly bpm = 92;

  musicVolume = 0.5;
  sfxVolume = 0.7;
  muted = false;
  playing = false;

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      // white noise buffer for drums
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.35, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.6, t, 0.02);
  }

  setMusicVolume(v: number) {
    this.musicVolume = v;
    this.applyVolumes();
  }
  setSfxVolume(v: number) {
    this.sfxVolume = v;
    this.applyVolumes();
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolumes();
  }

  // ---------- music ----------
  startMusic() {
    this.unlock();
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
  }

  private schedule() {
    if (!this.ctx) return;
    const sixteenth = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 64; // 4 bars of 16ths
    }
  }

  private playStep(step: number, t: number, len: number) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CHORDS[bar];

    // Arpeggio: 8ths over chord tones, up an octave
    if (s % 2 === 0) {
      const k = s / 2;
      const arpNote = chord[k % 3] + 12 + (k % 6 >= 3 ? 12 : 0);
      this.tone("square", NOTE(arpNote), t, len * 1.6, 0.045, this.musicBus);
    }

    // Bass: 8ths on root, octave bounce
    if (s % 2 === 0) {
      const root = chord[0] - 24 + (s % 4 === 2 ? 12 : 0);
      this.tone("triangle", NOTE(root), t, len * 1.8, 0.5, this.musicBus);
    }

    // Lead: 8ths
    if (s % 2 === 0) {
      const m = MELODY[bar * 8 + s / 2];
      if (m) this.tone("square", NOTE(m), t, len * 1.7, 0.09, this.musicBus, 6);
    }

    // Drums
    if (s === 0 || s === 8) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    if (s % 4 === 2) this.hat(t);
  }

  // ---------- synth primitives ----------
  private tone(
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    vol: number,
    bus: GainNode,
    vibrato = 0,
  ) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (vibrato) {
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private sweep(
    type: OscillatorType,
    from: number,
    to: number,
    t: number,
    dur: number,
    vol: number,
    bus: GainNode,
  ) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseHit(t: number, dur: number, vol: number, hp: number, bus: GainNode) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    this.sweep("sine", 150, 40, t, 0.15, 0.9, this.musicBus);
  }
  private snare(t: number) {
    this.noiseHit(t, 0.12, 0.35, 1500, this.musicBus);
  }
  private hat(t: number) {
    this.noiseHit(t, 0.03, 0.12, 7000, this.musicBus);
  }

  // ---------- sound effects ----------
  sfx(name: Sfx) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const b = this.sfxBus;
    switch (name) {
      case "hover":
        this.tone("square", 1320, t, 0.04, 0.08, b);
        break;
      case "click":
        this.tone("square", 880, t, 0.05, 0.2, b);
        this.tone("square", 1320, t + 0.05, 0.06, 0.2, b);
        break;
      case "move":
        this.tone("square", 660, t, 0.07, 0.2, b);
        break;
      case "ai":
        this.tone("triangle", 330, t, 0.09, 0.35, b);
        break;
      case "drop":
        this.sweep("square", 900, 180, t, 0.18, 0.2, b);
        break;
      case "coin":
        this.tone("square", 988, t, 0.06, 0.2, b);
        this.tone("square", 1319, t + 0.06, 0.18, 0.2, b);
        break;
      case "start":
        [523, 659, 784, 1047].forEach((f, i) => this.tone("square", f, t + i * 0.07, 0.12, 0.22, b));
        break;
      case "win":
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
          this.tone("square", f, t + i * 0.09, 0.16, 0.22, b),
        );
        break;
      case "lose":
        [392, 330, 262, 196].forEach((f, i) => this.tone("sawtooth", f, t + i * 0.14, 0.2, 0.18, b));
        break;
      case "draw":
        this.tone("square", 440, t, 0.15, 0.2, b);
        this.tone("square", 440, t + 0.2, 0.15, 0.2, b);
        break;
    }
  }
}

export const audio = new AudioEngine();
