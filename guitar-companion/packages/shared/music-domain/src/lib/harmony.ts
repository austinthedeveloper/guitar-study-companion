import { NoteAnalysis } from './analyze-notes';
import {
  assumedChordChanges,
  Chord,
  ChordChange,
  chordAt,
  noteRole,
  NoteRole,
  parseChord,
  parseProgression,
  ProgressionItem,
} from './chords';

/** A note's role over the chord in effect, and its bend target's. */
export interface NoteRoles {
  note: NoteRole | null;
  bendTo: NoteRole | null;
}

export interface Harmony {
  progression: ProgressionItem[];
  /** Placement in use: the user's, or the one-chord assumption. */
  changes: ChordChange[];
  /** True when `changes` is assumed rather than placed by the user. */
  assumed: boolean;
  /** Chord symbol in effect at each analysis column. */
  columnChords: (string | null)[];
  /** Understood chords in placement order (N.C. included). */
  chords: Chord[];
  /** Roles by event id, for notes under an understood chord. */
  roles: Record<string, NoteRoles>;
}

/** Combines note facts with the user's chord assumptions. */
export function harmonize(input: {
  analysis: NoteAnalysis;
  chords?: string;
  chordChanges?: readonly ChordChange[];
}): Harmony {
  const progression = parseProgression(input.chords);
  const placed = [...(input.chordChanges ?? [])];
  const assumed = placed.length === 0;
  const changes = (assumed ? assumedChordChanges(progression) : placed).sort(
    (a, b) => a.fromOrder - b.fromOrder,
  );
  const columnChords = input.analysis.columns.map((c) =>
    chordAt(changes, c.order),
  );
  const roles: Record<string, NoteRoles> = {};
  input.analysis.columns.forEach((col, i) => {
    const symbol = columnChords[i];
    const chord = symbol ? parseChord(symbol) : null;
    if (!chord) return;
    for (const n of col.notes)
      roles[n.eventId] = {
        note: n.midi === null ? null : noteRole(n.midi, chord),
        bendTo:
          n.bendToMidi === undefined ? null : noteRole(n.bendToMidi, chord),
      };
  });
  return {
    progression,
    changes,
    assumed: assumed && changes.length > 0,
    columnChords,
    chords: changes
      .map((c) => parseChord(c.chord))
      .filter((c): c is Chord => c !== null),
    roles,
  };
}
