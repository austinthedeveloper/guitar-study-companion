import { NoteAnalysis } from '@gsc/music-domain';
import { NoteEvent, PlayableColumn, toNoteEvents } from './notes';

/**
 * Turns an analysed phrase (optionally only some of its notes) into timed
 * sound events: bends glide to their target, dead notes click, and written
 * durations are used when the rhythm is known.
 */
export function phraseNoteEvents(
  analysis: NoteAnalysis,
  durations: ReadonlyMap<string, number | null>,
  options: { bpm: number; rhythmic: boolean; only?: ReadonlySet<string> },
): NoteEvent[] {
  const columns: PlayableColumn[] = analysis.columns
    .map((c) => {
      const notes = options.only
        ? c.notes.filter((n) => options.only?.has(n.eventId))
        : c.notes;
      return {
        notes: notes.map((n) => ({
          midi: n.midi,
          dead: n.dead,
          ...(n.bendToMidi !== undefined && n.midi !== null
            ? { bendSemitones: n.bendToMidi - n.midi }
            : {}),
        })),
        durationTicks: durations.get(notes[0]?.eventId ?? '') ?? null,
      };
    })
    .filter((c) => c.notes.length);
  return toNoteEvents(columns, options);
}
