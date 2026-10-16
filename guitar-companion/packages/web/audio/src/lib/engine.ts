import { pluckSamples } from './karplus';
import { clicksBetween } from './metronome';
import { midiToFrequency, NoteEvent, scheduleLength } from './notes';

/** Seconds of audio rendered per plucked note (it decays well before). */
const PLUCK_SECONDS = 2.5;
/** Small delay so the first note isn't clipped. */
const LEAD_IN = 0.05;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1;

export interface TimerApi {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

/**
 * Practice playback in the browser: plucked-string notes (bends glide up,
 * dead notes are a muted click) and a metronome. The AudioContext is made
 * lazily on first use, which must follow a user gesture.
 */
export class PracticeAudio {
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<number | 'mute', AudioBuffer>();
  private sources: AudioScheduledSourceNode[] = [];
  private metronome: { id: unknown; until: number } | null = null;
  private endTimer: unknown = null;

  constructor(
    private readonly createContext: () => AudioContext = () =>
      new AudioContext(),
    private readonly timers: TimerApi = globalThis as unknown as TimerApi,
  ) {}

  private context(): AudioContext {
    this.ctx ??= this.createContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private buffer(key: number | 'mute'): AudioBuffer {
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const ctx = this.context();
    const samples =
      key === 'mute'
        ? pluckSamples(110, ctx.sampleRate, 0.04, { damping: 0.7, seed: 7 })
        : pluckSamples(midiToFrequency(key), ctx.sampleRate, PLUCK_SECONDS);
    const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buf.copyToChannel(samples, 0);
    this.buffers.set(key, buf);
    return buf;
  }

  /** Plays a schedule; calls onEnded when it finishes (not when stopped). */
  play(events: readonly NoteEvent[], onEnded?: () => void): number {
    this.stopNotes();
    const ctx = this.context();
    const t0 = ctx.currentTime + LEAD_IN;
    for (const e of events) {
      const start = t0 + e.start;
      const source = ctx.createBufferSource();
      source.buffer = this.buffer(e.midi ?? 'mute');
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(e.midi === null ? 0.4 : 0.6, start);
      gain.gain.setTargetAtTime(0, start + e.duration, 0.04);
      if (e.bendCents) {
        source.detune.setValueAtTime(0, start + e.duration * 0.2);
        source.detune.linearRampToValueAtTime(
          e.bendCents,
          start + e.duration * 0.55,
        );
      }
      source.connect(gain).connect(ctx.destination);
      source.start(start);
      source.stop(start + e.duration + 0.3);
      this.sources.push(source);
    }
    const length = scheduleLength(events);
    if (onEnded)
      this.endTimer = this.timers.setTimeout(
        () => onEnded(),
        (LEAD_IN + length + 0.3) * 1000,
      );
    return length;
  }

  stopNotes(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    }
    this.sources = [];
    if (this.endTimer !== null) {
      this.timers.clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }

  /** Starts (or retunes) the metronome; onBeat fires as each click sounds. */
  startMetronome(
    bpm: number,
    onBeat?: (beat: number, accent: boolean) => void,
    beatsPerBar = 4,
  ): void {
    this.stopMetronome();
    const ctx = this.context();
    const startTime = ctx.currentTime + LEAD_IN;
    const state = { id: null as unknown, until: startTime };
    const tick = () => {
      const to = ctx.currentTime + SCHEDULE_AHEAD;
      for (const c of clicksBetween(
        bpm,
        startTime,
        state.until,
        to,
        beatsPerBar,
      )) {
        const osc = ctx.createOscillator();
        osc.frequency.value = c.accent ? 1500 : 1000;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, c.time);
        gain.gain.exponentialRampToValueAtTime(0.001, c.time + 0.03);
        osc.connect(gain).connect(ctx.destination);
        osc.start(c.time);
        osc.stop(c.time + 0.04);
        if (onBeat)
          this.timers.setTimeout(
            () => onBeat(c.beat, c.accent),
            Math.max(0, (c.time - ctx.currentTime) * 1000),
          );
      }
      state.until = to;
    };
    tick();
    state.id = this.timers.setInterval(tick, LOOKAHEAD_MS);
    this.metronome = state;
  }

  stopMetronome(): void {
    if (this.metronome) this.timers.clearInterval(this.metronome.id);
    this.metronome = null;
  }

  get metronomeRunning(): boolean {
    return this.metronome !== null;
  }

  dispose(): void {
    this.stopNotes();
    this.stopMetronome();
    void this.ctx?.close();
    this.ctx = null;
    this.buffers.clear();
  }
}
