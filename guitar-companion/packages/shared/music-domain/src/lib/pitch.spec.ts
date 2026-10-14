import {
  midiToNoteName,
  pitchAt,
  semitonesBetween,
  STANDARD_TUNING_MIDI,
} from './pitch';

describe('pitchAt', () => {
  it('returns open-string pitches for standard tuning', () => {
    expect(
      STANDARD_TUNING_MIDI.map((_, i) =>
        midiToNoteName(
          pitchAt(STANDARD_TUNING_MIDI, { stringIndex: i, fret: 0 }),
        ),
      ),
    ).toEqual(['E4', 'B3', 'G3', 'D3', 'A2', 'E2']);
  });

  it('adds fret and capo', () => {
    expect(pitchAt(STANDARD_TUNING_MIDI, { stringIndex: 0, fret: 5 })).toBe(69);
    expect(pitchAt(STANDARD_TUNING_MIDI, { stringIndex: 0, fret: 5 }, 2)).toBe(
      71,
    );
  });

  it('handles alternate tunings (drop D)', () => {
    const dropD = [64, 59, 55, 50, 45, 38];
    expect(midiToNoteName(pitchAt(dropD, { stringIndex: 5, fret: 0 }))).toBe(
      'D2',
    );
  });

  it.each([
    [{ stringIndex: 6, fret: 0 }, 0],
    [{ stringIndex: -1, fret: 0 }, 0],
    [{ stringIndex: 0, fret: -1 }, 0],
    [{ stringIndex: 0, fret: 25 }, 0],
    [{ stringIndex: 0, fret: 23 }, 2],
    [{ stringIndex: 0, fret: 1.5 }, 0],
  ])('rejects invalid position %o with capo %i', (pos, capo) => {
    expect(() => pitchAt(STANDARD_TUNING_MIDI, pos, capo)).toThrow(RangeError);
  });
});

describe('midiToNoteName', () => {
  it('names middle C and sharps', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(61)).toBe('C#4');
  });

  it('rejects out-of-range pitches', () => {
    expect(() => midiToNoteName(128)).toThrow(RangeError);
  });
});

describe('semitonesBetween', () => {
  it('is signed', () => {
    expect(semitonesBetween(60, 67)).toBe(7);
    expect(semitonesBetween(67, 60)).toBe(-7);
  });
});
