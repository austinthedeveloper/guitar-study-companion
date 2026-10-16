import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { NoteEvent, PracticeAudio } from '@gsc/web/audio';
import { AUDIO_ENGINE } from './audio-engine';

/** What playback needs to know about an exercise-like item. */
export interface PlayableItem {
  id: string;
  tempo: { startBpm: number; targetBpm: number };
}

/**
 * Per-page playback state for exercise cards: one item plays or runs the
 * metronome at a time, each item keeps its own tempo within its ramp.
 * Provide it in the page component (`providers: [ExercisePlayback]`).
 */
@Injectable()
export class ExercisePlayback {
  private readonly create = inject(AUDIO_ENGINE);
  private audio: PracticeAudio | null = null;
  private readonly bpm = signal<Record<string, number>>({});
  readonly playingId = signal<string | null>(null);
  readonly metronomeId = signal<string | null>(null);
  readonly beat = signal(0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.audio?.dispose());
  }

  private engine(): PracticeAudio {
    this.audio ??= this.create();
    return this.audio;
  }

  bpmOf(x: PlayableItem): number {
    return this.bpm()[x.id] ?? x.tempo.startBpm;
  }

  /** Sets an item's tempo within its ramp; retunes a running metronome. */
  setTempo(x: PlayableItem, bpm: number): void {
    const clamped = Math.min(
      x.tempo.targetBpm,
      Math.max(x.tempo.startBpm, bpm),
    );
    this.bpm.update((m) => ({ ...m, [x.id]: clamped }));
    if (this.metronomeId() === x.id) this.startMetronome(x);
  }

  resetTempos(): void {
    this.bpm.set({});
  }

  play(id: string, events: readonly NoteEvent[]): void {
    this.playingId.set(id);
    this.engine().play(events, () => this.playingId.set(null));
  }

  /** Plays without tracking (e.g. a reference note). */
  playOnce(events: readonly NoteEvent[]): void {
    this.engine().play(events);
  }

  stop(): void {
    this.audio?.stopNotes();
    this.audio?.stopMetronome();
    this.playingId.set(null);
    this.metronomeId.set(null);
  }

  toggleMetronome(x: PlayableItem): void {
    if (this.metronomeId() === x.id) {
      this.engine().stopMetronome();
      this.metronomeId.set(null);
    } else this.startMetronome(x);
  }

  private startMetronome(x: PlayableItem): void {
    this.metronomeId.set(x.id);
    this.beat.set(0);
    this.engine().startMetronome(this.bpmOf(x), (b) => this.beat.set(b));
  }
}
