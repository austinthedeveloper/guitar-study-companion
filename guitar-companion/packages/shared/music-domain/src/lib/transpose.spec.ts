import { analyzeNotes } from './analyze-notes';
import { parseKey } from './keys';
import { STANDARD_TUNING_MIDI } from './pitch';
import {
  transposeChord,
  transposePhrase,
  transposeProgression,
  transposeSemitones,
  validateTransposition,
} from './transpose';
import { EventLike } from './validate-events';

const key = (k: string) => parseKey(k)!;
const ev = (
  id: string,
  order: number,
  stringIndex: number,
  fret: number | null,
  techniques: string[] = [],
  bendSemitones?: number,
): EventLike => ({
  id,
  order,
  stringIndex,
  fret,
  durationTicks: null,
  techniques,
  ...(bendSemitones ? { bendSemitones } : {}),
});
// A7 -> D7 blues lick: C4 C#4(h) E4 G4->A4 A4 F#4 D4~
const blues = [
  ev('e1', 0, 2, 5),
  ev('e2', 1, 2, 6, ['hammer-on']),
  ev('e3', 2, 1, 5),
  ev('e4', 3, 1, 8, ['bend'], 2),
  ev('e5', 4, 0, 5),
  ev('e6', 5, 1, 7),
  ev('e7', 6, 2, 7, ['vibrato']),
];
const opts = {
  tuningMidi: STANDARD_TUNING_MIDI,
  capo: 0,
  maxFret: 22,
  position: null,
};
const run = (events: EventLike[], semitones: number, o = {}) =>
  transposePhrase(
    events,
    analyzeNotes({ events, tuningMidi: STANDARD_TUNING_MIDI }),
    semitones,
    { ...opts, ...o },
  );
const validate = (
  events: EventLike[],
  out: EventLike[],
  semitones: number,
  maxFret = 22,
) =>
  validateTransposition({
    original: events,
    transposed: out,
    semitones,
    tuningMidi: STANDARD_TUNING_MIDI,
    capo: 0,
    maxFret,
  });

describe('transposeSemitones', () => {
  it('takes the nearest octave by default, or the one asked for', () => {
    expect(transposeSemitones(key('A'), key('C'))).toBe(3);
    expect(transposeSemitones(key('A'), key('F'))).toBe(-4);
    expect(transposeSemitones(key('A'), key('F'), 'up')).toBe(8);
    expect(transposeSemitones(key('A'), key('C'), 'down')).toBe(-9);
    expect(transposeSemitones(key('Em'), key('E'), 'down')).toBe(0);
  });
});

describe('transposeChord / transposeProgression', () => {
  it('moves roots and slash basses, spelled in the target key', () => {
    expect(transposeChord('A7', 3, key('C'))).toEqual({
      symbol: 'C7',
      understood: true,
    });
    expect(transposeChord('D/F#', 3, key('F')).symbol).toBe('F/A');
    expect(transposeChord('A7', 1, key('Bb')).symbol).toBe('Bb7');
    expect(transposeChord('A7', 1).symbol).toBe('A#7');
    expect(transposeChord('Bm7b5', 3, key('D')).symbol).toBe('Dm7b5');
  });

  it('leaves N.C. and unknown symbols alone, flagging the unknown', () => {
    expect(transposeChord('N.C.', 3)).toEqual({
      symbol: 'N.C.',
      understood: true,
    });
    expect(transposeChord('Xyz', 3)).toEqual({
      symbol: 'Xyz',
      understood: false,
    });
  });

  it('keeps bar lines and spacing in a progression', () => {
    expect(transposeProgression('| A7 D7 | E7, N.C. |', 3, key('C'))).toBe(
      '| C7 F7 | G7, N.C. |',
    );
  });
});

describe('transposePhrase', () => {
  it('keeps the original shape when no position is asked for (A to C, +3)', () => {
    const { events } = run(blues, 3);
    expect(events?.map((e) => [e.stringIndex, e.fret])).toEqual([
      [2, 8],
      [2, 9],
      [1, 8],
      [1, 11],
      [0, 8],
      [1, 10],
      [2, 10],
    ]);
    expect(validate(blues, events!, 3)).toEqual([]);
  });

  it('moves into the preferred position within the fret limit, keeping slurs on one string', () => {
    const { events } = run(blues, 3, { position: 0, maxFret: 12 });
    expect(events).not.toBeNull();
    expect(validate(blues, events!, 3, 12)).toEqual([]);
    const [h1, h2] = events!;
    expect(h1.stringIndex).toBe(h2.stringIndex);
    expect(Math.max(...events!.map((e) => e.fret ?? 0))).toBeLessThanOrEqual(
      12,
    );
    // No open string is bent.
    expect(events![3].fret).toBeGreaterThan(0);
  });

  it('says which note falls off the instrument', () => {
    const low = [ev('a', 0, 5, 0), ev('b', 1, 5, 3)];
    expect(run(low, -1)).toEqual({
      events: null,
      semitones: -1,
      problem:
        "Note 1 (E2 moved by -1 semitones) can't be played on this tuning within fret 22. Try the other octave or a higher fret limit.",
    });
  });

  it('re-places natural harmonics on a node that sounds the new pitch', () => {
    // G string 12th-fret harmonic (G4) up a whole step: A4 is the 7th-fret
    // harmonic on the D string.
    const { events } = run([ev('h', 0, 2, 12, ['harmonic'])], 2);
    expect(events).toEqual([
      expect.objectContaining({ stringIndex: 3, fret: 7 }),
    ]);
  });

  it('keeps dead notes on their string', () => {
    const riff = [ev('x', 0, 4, null, ['dead-note']), ev('n', 1, 4, 5)];
    expect(run(riff, 2).events?.[0]).toMatchObject({
      stringIndex: 4,
      fret: null,
    });
  });
});

describe('validateTransposition', () => {
  it('catches wrong shifts, split slurs, open-string bends, and frets past the limit', () => {
    const bad = [
      { ...blues[0], fret: 7 },
      { ...blues[1], stringIndex: 1, fret: 5 },
      { ...blues[2], fret: 8 },
      { ...blues[3], stringIndex: 0, fret: 0 },
      ...blues.slice(4).map((e) => ({ ...e, fret: (e.fret ?? 0) + 3 })),
    ];
    const messages = validate(blues, bad, 3, 12).map(
      (i) => `${i.eventId}: ${i.message}`,
    );
    expect(messages).toEqual(
      expect.arrayContaining([
        'e1: Moved by 2 semitones instead of 3.',
        'e2: Slur no longer on one string.',
        "e4: An open string can't be bent.",
      ]),
    );
  });
});
