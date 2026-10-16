import { analyzeNotes, describeStep, intervalName } from './analyze-notes';
import { parseKey } from './keys';
import { STANDARD_TUNING_MIDI } from './pitch';
import { EventLike } from './validate-events';

let nextId = 0;
const ev = (
  order: number,
  stringIndex: number,
  fret: number | null,
  techniques: string[] = [],
  bendSemitones?: number,
): EventLike => ({
  id: `e${++nextId}`,
  order,
  stringIndex,
  fret,
  durationTicks: null,
  techniques,
  ...(bendSemitones ? { bendSemitones } : {}),
});
const analyze = (events: EventLike[], key?: string, capo = 0) =>
  analyzeNotes({
    events,
    tuningMidi: STANDARD_TUNING_MIDI,
    capo,
    key: parseKey(key),
  });

describe('intervalName', () => {
  it('names simple and compound intervals by size, ignoring direction', () => {
    expect([0, 3, -4, 6, 7, 12, 14, -19, 24].map(intervalName)).toEqual([
      'P1',
      'm3',
      'M3',
      'TT',
      'P5',
      'P8',
      'M9',
      'P12',
      'P15',
    ]);
    expect(intervalName(27)).toBe('27 semitones');
  });
});

describe('describeStep', () => {
  it('describes chords, steps, repeats, and line starts', () => {
    const iv = (semitones: number) => ({
      semitones,
      name: intervalName(semitones),
    });
    expect(describeStep(null, [iv(7)])).toBe('chord: P5');
    expect(describeStep(iv(-3), [])).toBe('m3 down');
    expect(describeStep(iv(0), [])).toBe('same note');
    expect(describeStep(null, [])).toBeNull();
  });
});

describe('analyzeNotes', () => {
  it('reads a power-chord riff with dead notes (scan03 shape)', () => {
    const { columns, range, pitchClasses } = analyze([
      ev(0, 4, null, ['dead-note']),
      ev(0, 5, null, ['dead-note']),
      ev(1, 5, 0),
      ev(2, 4, 7),
      ev(2, 5, 5),
      ev(3, 5, 0),
    ]);
    expect(columns[0].notes.map((n) => n.midi)).toEqual([null, null]);
    expect(columns[0].chordIntervals).toEqual([]);
    expect(columns[1].notes[0].name).toBe('E2');
    expect(columns[1].fromPrevious).toBeNull();
    // A5: A2 + E3, lowest first.
    expect(columns[2].notes.map((n) => n.name)).toEqual(['A2', 'E3']);
    expect(columns[2].chordIntervals).toEqual([{ semitones: 7, name: 'P5' }]);
    expect(columns[2].fromPrevious).toBeNull();
    // A chord breaks the melodic line.
    expect(columns[3].fromPrevious).toBeNull();
    expect(range).toEqual({ lowest: 'E2', highest: 'E3' });
    expect(pitchClasses).toEqual(['E', 'A']);
  });

  it('follows a lick through a bend to its target (A minor)', () => {
    const { columns, pitchClasses } = analyze(
      [
        ev(0, 2, 5),
        ev(1, 2, 7, ['hammer-on']),
        ev(2, 1, 5),
        ev(3, 1, 8, ['bend'], 2),
        ev(4, 0, 5),
      ],
      'Am',
    );
    expect(columns.map((c) => c.notes[0].name)).toEqual([
      'C4',
      'D4',
      'E4',
      'G4',
      'A4',
    ]);
    expect(columns[3].notes[0]).toMatchObject({
      bendToMidi: 69,
      bendToName: 'A4',
    });
    expect(columns.map((c) => c.fromPrevious)).toEqual([
      null,
      { semitones: 2, name: 'M2' },
      { semitones: 2, name: 'M2' },
      { semitones: 3, name: 'm3' },
      // Measured from the bend target A4, not the fretted G4.
      { semitones: 0, name: 'P1' },
    ]);
    expect(pitchClasses).toEqual(['C', 'D', 'E', 'G', 'A']);
  });

  it('measures melody across dead-note columns and downward', () => {
    const { columns } = analyze([
      ev(0, 0, 8),
      ev(1, 1, null, ['dead-note']),
      ev(2, 0, 5),
    ]);
    expect(columns[2].fromPrevious).toEqual({ semitones: -3, name: 'm3' });
  });

  it('spells by the given key and applies capo', () => {
    expect(analyze([ev(0, 3, 11)], 'Bbm').columns[0].notes[0].name).toBe('Db4');
    expect(analyze([ev(0, 0, 0)], 'D', 2).columns[0].notes[0].name).toBe('F#4');
  });

  it('gives natural harmonics their sounding pitch, and unknown nodes none', () => {
    const { columns } = analyze([
      ev(0, 2, 12, ['harmonic']),
      ev(1, 2, 7, ['harmonic']),
      ev(2, 2, 3, ['harmonic']),
    ]);
    expect(columns.map((c) => c.notes[0].name)).toEqual(['G4', 'D5', null]);
  });

  it('does not name quarter-tone bend targets', () => {
    const note = analyze([ev(0, 1, 8, ['bend'], 0.5)]).columns[0].notes[0];
    expect(note.bendToMidi).toBeUndefined();
    expect(note.name).toBe('G4');
  });

  it('returns an empty analysis for no pitched notes', () => {
    expect(analyze([ev(0, 0, null, ['dead-note'])])).toMatchObject({
      range: null,
      pitchClasses: [],
    });
  });
});
