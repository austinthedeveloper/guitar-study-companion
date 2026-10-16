import { parseKey, pitchClassOf, spellMidi, spellPitchClass } from './keys';

describe('parseKey', () => {
  it.each([
    ['A', 'A', 9, 'major'],
    ['Am', 'A', 9, 'minor'],
    ['a minor', 'A', 9, 'minor'],
    ['F#m', 'F#', 6, 'minor'],
    ['Bb major', 'Bb', 10, 'major'],
    ['C#min', 'C#', 1, 'minor'],
    ['E♭', 'Eb', 3, 'major'],
    [' Gmaj ', 'G', 7, 'major'],
  ])('understands %j', (text, tonic, tonicPc, mode) => {
    expect(parseKey(text)).toEqual({ tonic, tonicPc, mode });
  });

  it.each(['', 'H', 'A dorian', 'blues in A', 'A#b'])(
    'leaves %j unknown instead of guessing',
    (text) => {
      expect(parseKey(text)).toBeNull();
    },
  );

  it('treats undefined as unknown', () => {
    expect(parseKey(undefined)).toBeNull();
  });
});

describe('spelling', () => {
  const key = (text: string) => parseKey(text);

  it('uses sharps without a key', () => {
    expect(spellPitchClass(10)).toBe('A#');
  });

  it('spells notes of the key signature with one letter per degree', () => {
    expect(spellPitchClass(1, key('A'))).toBe('C#');
    expect(spellPitchClass(1, key('Bbm'))).toBe('Db');
    expect(spellPitchClass(6, key('Bbm'))).toBe('Gb');
    expect(spellPitchClass(5, key('F#'))).toBe('E#');
    expect(spellPitchClass(11, key('Gb'))).toBe('Cb');
  });

  it('follows the signature direction for notes outside the key', () => {
    // Blue notes: b5 of D minor is Ab, of A minor is D#.
    expect(spellPitchClass(8, key('Dm'))).toBe('Ab');
    expect(spellPitchClass(3, key('Am'))).toBe('D#');
    expect(spellPitchClass(3, key('A'))).toBe('D#');
  });

  it('keeps the octave with the letter', () => {
    expect(spellMidi(61, key('Bbm'))).toBe('Db4');
    expect(spellMidi(60, key('C#'))).toBe('B#3');
    expect(spellMidi(59, key('Gb'))).toBe('Cb4');
    expect(spellMidi(60)).toBe('C4');
  });

  it('reads spelled names back to pitch classes', () => {
    expect(['C', 'B#', 'Cb', 'Ebb', 'f#'].map(pitchClassOf)).toEqual([
      0, 0, 11, 2, 6,
    ]);
    expect(pitchClassOf('X')).toBeNull();
  });
});
