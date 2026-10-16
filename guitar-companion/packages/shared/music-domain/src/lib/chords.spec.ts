import {
  assumedChordChanges,
  chordAt,
  chordToneNames,
  noteRole,
  parseChord,
  parseProgression,
} from './chords';

const chord = (s: string) => {
  const c = parseChord(s);
  if (!c) throw new Error(`unparsed ${s}`);
  return c;
};

describe('parseChord', () => {
  it.each([
    ['A', ['A', 'C#', 'E']],
    ['Am', ['A', 'C', 'E']],
    ['A5', ['A', 'E']],
    ['A7', ['A', 'C#', 'E', 'G']],
    ['Cm7', ['C', 'Eb', 'G', 'Bb']],
    ['Fmaj7', ['F', 'A', 'C', 'E']],
    ['Bm7b5', ['B', 'D', 'F', 'A']],
    ['Bb7', ['Bb', 'D', 'F', 'Ab']],
    ['E7#9', ['E', 'G#', 'B', 'D', 'G']],
    ['Dsus4', ['D', 'G', 'A']],
    ['C#dim7', ['C#', 'E', 'G', 'A#']],
    ['E♭m', ['Eb', 'Gb', 'Bb']],
  ])('spells %s', (symbol, names) => {
    expect(chordToneNames(chord(symbol))).toEqual(names);
  });

  it('reads slash-chord bass notes', () => {
    expect(parseChord('D/F#')).toMatchObject({ rootPc: 2, bassPc: 6 });
    expect(parseChord('G')).toMatchObject({ rootPc: 7, bassPc: 7 });
  });

  it('understands "no chord"', () => {
    expect(parseChord('N.C.')).toMatchObject({ rootPc: null, tones: [] });
  });

  it.each(['H7', 'Cmaj13#11', 'Am/X', '', 'A minor'])(
    'returns null for %j instead of guessing',
    (s) => {
      expect(parseChord(s)).toBeNull();
    },
  );
});

describe('parseProgression', () => {
  it('splits on spaces, bar lines, and commas, keeping unknown symbols', () => {
    const items = parseProgression('| G D/F# | Em, C | %  Cmaj13#11 |');
    expect(items.map((i) => i.text)).toEqual([
      'G',
      'D/F#',
      'Em',
      'C',
      'Cmaj13#11',
    ]);
    expect(items.map((i) => !!i.chord)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('handles missing text', () => {
    expect(parseProgression(undefined)).toEqual([]);
  });
});

describe('noteRole', () => {
  it('labels chord tones by function', () => {
    // Over A7: C# is the 3rd, G the b7.
    expect(noteRole(61, chord('A7'))).toEqual({ label: '3', chordTone: true });
    expect(noteRole(67, chord('A7'))).toEqual({ label: 'b7', chordTone: true });
    expect(noteRole(64, chord('A7'))).toEqual({ label: '5', chordTone: true });
  });

  it('labels other notes relative to the root', () => {
    // Blue note C over A7, and the 4th D.
    expect(noteRole(60, chord('A7'))).toEqual({
      label: 'b3',
      chordTone: false,
    });
    expect(noteRole(62, chord('A7'))).toEqual({ label: '4', chordTone: false });
  });

  it('uses the chord’s own label when a tone could be read two ways', () => {
    // 3 semitones above E is the #9 in E7#9, not a b3.
    expect(noteRole(67, chord('E7#9'))).toEqual({
      label: '#9',
      chordTone: true,
    });
  });

  it('has no role over N.C.', () => {
    expect(noteRole(60, chord('N.C.'))).toBeNull();
  });
});

describe('chord placement', () => {
  const changes = [
    { fromOrder: 4, chord: 'D' },
    { fromOrder: 0, chord: 'A' },
  ];

  it('finds the chord in effect at a column', () => {
    expect([0, 3, 4, 9].map((o) => chordAt(changes, o))).toEqual([
      'A',
      'A',
      'D',
      'D',
    ]);
    expect(chordAt([{ fromOrder: 2, chord: 'E' }], 1)).toBeNull();
  });

  it('assumes one chord for the whole phrase only when there is just one', () => {
    expect(assumedChordChanges(parseProgression('A7'))).toEqual([
      { fromOrder: 0, chord: 'A7' },
    ]);
    expect(assumedChordChanges(parseProgression('A7 D7'))).toEqual([]);
    expect(assumedChordChanges(parseProgression('Xyz'))).toEqual([]);
  });
});
