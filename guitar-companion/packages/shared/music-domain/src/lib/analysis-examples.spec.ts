/**
 * Hand-authored analysis examples (M2 exit check). Each phrase is invented
 * for testing and described musically; the expectations are what a
 * guitar teacher would say, worked out by hand, not read back from code.
 * Includes ambiguous and under-specified cases on purpose.
 */
import { analyzeNotes } from './analyze-notes';
import { harmonize } from './harmony';
import { parseKey } from './keys';
import { STANDARD_TUNING_MIDI } from './pitch';
import { candidateScales, ScaleAnalysis } from './scales';
import { EventLike } from './validate-events';

/**
 * Compact tab: space-separated columns, "+" joins simultaneous notes.
 * Each note is string:fret with string 1 = high E (guitar convention).
 * Fret "x" is a dead note. Suffixes: h hammer-on, p pull-off, ~ vibrato,
 * * natural harmonic, bN bend by N semitones.
 */
function tab(text: string): EventLike[] {
  let id = 0;
  return text.split(/\s+/).flatMap((column, order) =>
    column.split('+').map((note) => {
      const m = /^(\d):(x|\d+)(h|p)?(~)?(\*)?(?:b(\d))?$/.exec(note);
      if (!m) throw new Error(`bad note ${note}`);
      const techniques = [
        m[3] === 'h' ? 'hammer-on' : null,
        m[3] === 'p' ? 'pull-off' : null,
        m[4] ? 'vibrato' : null,
        m[5] ? 'harmonic' : null,
        m[6] ? 'bend' : null,
        m[2] === 'x' ? 'dead-note' : null,
      ].filter((t): t is string => !!t);
      return {
        id: `e${++id}`,
        order,
        stringIndex: Number(m[1]) - 1,
        fret: m[2] === 'x' ? null : Number(m[2]),
        durationTicks: null,
        techniques,
        ...(m[6] ? { bendSemitones: Number(m[6]) } : {}),
      };
    }),
  );
}

interface Example {
  name: string;
  tab: string;
  tuning?: readonly number[];
  capo?: number;
  key?: string;
  chords?: string;
  /** Chord placement as [column index, chord]. */
  placed?: [number, string][];
  expect: {
    /** Per column, notes joined with "+", bend targets as "G4→A4". */
    names?: string[];
    /** Per column, roles joined with "+"; "" for no role. */
    roles?: string[];
    certainty?: ScaleAnalysis['certainty'];
    topScale?: string;
    /** The top candidates must include all of these (ambiguous cases). */
    among?: string[];
    outside?: string[];
  };
}

const EXAMPLES: Example[] = [
  {
    name: 'A7 to D7 blues lick: b3-3 hammer, b7 bent to the root, then 3 and root of D7',
    tab: '3:5 3:6h 2:5 2:8b2 1:5 2:7 3:7~',
    key: 'A',
    chords: 'A7 D7',
    placed: [
      [0, 'A7'],
      [5, 'D7'],
    ],
    expect: {
      names: ['C4', 'C#4', 'E4', 'G4→A4', 'A4', 'F#4', 'D4'],
      roles: ['b3', '3', '5', 'b7→R', 'R', '3', 'R'],
      // No common scale holds both C and C#: A mixolydian with a blue b3.
      topScale: 'A mixolydian',
      outside: ['C'],
      certainty: 'clear',
    },
  },
  {
    name: 'Pentatonic run with no key or chords: A minor or C major is a coin toss',
    tab: '1:5 1:8 1:10 1:12 1:15 1:12',
    expect: {
      names: ['A4', 'C5', 'D5', 'E5', 'G5', 'E5'],
      roles: ['', '', '', '', '', ''],
      certainty: 'ambiguous',
      among: ['A minor pentatonic', 'C major pentatonic'],
    },
  },
  {
    name: 'The same run over a C chord: assumed for the whole phrase, now C major pentatonic',
    tab: '1:5 1:8 1:10 1:12 1:15 1:12',
    chords: 'C',
    expect: {
      roles: ['6', 'R', '2', '3', '5', '3'],
      topScale: 'C major pentatonic',
      certainty: 'clear',
    },
  },
  {
    name: 'Power-chord riff with dead strums: too few pitches to name a scale',
    tab: '5:x+6:x 6:0 5:7+6:5 5:x+6:x 5:7+6:5 6:0',
    chords: 'E5',
    expect: {
      names: ['x+x', 'E2', 'A2+E3', 'x+x', 'A2+E3', 'E2'],
      // The A5 shape over E5: its A is the 4, its E the root.
      roles: ['', 'R', '4+R', '', '4+R', 'R'],
      certainty: 'insufficient',
    },
  },
  {
    name: 'Bb minor lick spells with flats',
    tab: '3:3 3:6 2:4 2:6 1:4 1:6',
    key: 'Bbm',
    expect: {
      names: ['Bb3', 'Db4', 'Eb4', 'F4', 'Ab4', 'Bb4'],
      topScale: 'Bb minor pentatonic',
      certainty: 'clear',
    },
  },
  {
    name: 'Pickup over N.C., then D/F#: no roles before the band comes in',
    tab: '2:3 2:5 1:2 1:5',
    chords: 'N.C. D/F#',
    placed: [
      [0, 'N.C.'],
      [2, 'D/F#'],
    ],
    expect: {
      names: ['D4', 'E4', 'F#4', 'A4'],
      roles: ['', '', '3', '5'],
    },
  },
  {
    name: 'Chord symbols the parser does not know give no roles rather than guesses',
    tab: '1:5 1:8',
    chords: 'Cmaj13#11',
    expect: { roles: ['', ''] },
  },
  {
    name: 'Drop D with a 12th-fret harmonic on the low string sounds D3',
    tab: '6:0 6:12* 4:12*',
    tuning: [64, 59, 55, 50, 45, 38],
    expect: { names: ['D2', 'D3', 'D4'] },
  },
  {
    name: 'Capo 2: open strings sound a whole step up',
    tab: '3:0 2:0 1:0',
    capo: 2,
    key: 'A',
    expect: { names: ['A3', 'C#4', 'F#4'] },
  },
];

describe('hand-authored analysis examples', () => {
  it.each(EXAMPLES.map((e) => [e.name, e] as const))('%s', (_, ex) => {
    const events = tab(ex.tab);
    const key = parseKey(ex.key);
    const analysis = analyzeNotes({
      events,
      tuningMidi: ex.tuning ?? STANDARD_TUNING_MIDI,
      capo: ex.capo ?? 0,
      key,
    });
    const harmony = harmonize({
      analysis,
      chords: ex.chords,
      chordChanges: (ex.placed ?? []).map(([col, chord]) => ({
        fromOrder: analysis.columns[col].order,
        chord,
      })),
    });
    const scales = candidateScales({ analysis, key, chords: harmony.chords });

    if (ex.expect.names)
      expect(
        analysis.columns.map((c) =>
          c.notes
            .map((n) =>
              n.dead
                ? 'x'
                : n.bendToName
                  ? `${n.name}→${n.bendToName}`
                  : n.name,
            )
            .join('+'),
        ),
      ).toEqual(ex.expect.names);
    if (ex.expect.roles)
      expect(
        analysis.columns.map((c) =>
          c.notes
            .map((n) => {
              const r = harmony.roles[n.eventId];
              if (!r?.note) return null;
              return r.bendTo
                ? `${r.note.label}→${r.bendTo.label}`
                : r.note.label;
            })
            .filter((r) => r !== null)
            .join('+'),
        ),
      ).toEqual(ex.expect.roles);
    if (ex.expect.certainty) expect(scales.certainty).toBe(ex.expect.certainty);
    if (ex.expect.topScale)
      expect(scales.candidates[0]?.name).toBe(ex.expect.topScale);
    if (ex.expect.outside)
      expect(scales.candidates[0]?.outside).toEqual(ex.expect.outside);
    if (ex.expect.among)
      expect(scales.candidates.map((c) => c.name)).toEqual(
        expect.arrayContaining(ex.expect.among),
      );
  });
});
