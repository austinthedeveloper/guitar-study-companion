/** One column of tab ready to sound: notes together, plus an optional written duration. */
export interface PlayableColumn {
  notes: {
    /** Sounding pitch; null for dead notes and unknown harmonics. */
    midi: number | null;
    /** Whole-number bend in semitones, if the note is bent. */
    bendSemitones?: number;
    dead: boolean;
  }[];
  /** Written duration in ticks, when rhythm is known. */
  durationTicks?: number | null;
}

/** A sound to schedule, in seconds from the start of playback. */
export interface NoteEvent {
  /** Null for a muted (percussive) note. */
  midi: number | null;
  start: number;
  duration: number;
  /** Pitch rise reached during the note, in cents (bends). */
  bendCents: number;
}

export const TICKS_PER_QUARTER = 480;
/** Notes sound for this share of their slot so repeated notes re-articulate. */
const GATE = 0.9;

/**
 * Lays out columns in time. Without rhythm every column gets one beat
 * (one note per click), which is a practice pulse, not the real rhythm.
 */
export function toNoteEvents(
  columns: readonly PlayableColumn[],
  options: { bpm: number; rhythmic: boolean },
): NoteEvent[] {
  const beat = 60 / options.bpm;
  const out: NoteEvent[] = [];
  let time = 0;
  for (const col of columns) {
    const beats =
      options.rhythmic && col.durationTicks
        ? col.durationTicks / TICKS_PER_QUARTER
        : 1;
    const slot = beats * beat;
    for (const n of col.notes)
      out.push({
        midi: n.dead ? null : n.midi,
        start: time,
        duration: n.dead ? Math.min(0.08, slot) : slot * GATE,
        bendCents: n.dead ? 0 : (n.bendSemitones ?? 0) * 100,
      });
    time += slot;
  }
  return out;
}

/** Total length of a schedule in seconds. */
export function scheduleLength(events: readonly NoteEvent[]): number {
  return events.reduce((end, e) => Math.max(end, e.start + e.duration), 0);
}

export const midiToFrequency = (midi: number) =>
  440 * Math.pow(2, (midi - 69) / 12);
