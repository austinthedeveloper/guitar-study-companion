import { analyzeNotes } from './analyze-notes';
import { parseChord } from './chords';
import { parseKey } from './keys';
import { STANDARD_TUNING_MIDI } from './pitch';
import { candidateScales } from './scales';

/** Single notes on the high E string (fret 5 = A4, 8 = C5, 15 = G5...). */
const lick = (...frets: number[]) =>
  analyzeNotes({
    events: frets.map((fret, i) => ({
      id: `e${i}`,
      order: i,
      stringIndex: 0,
      fret,
      durationTicks: null,
      techniques: [],
    })),
    tuningMidi: STANDARD_TUNING_MIDI,
  });
const names = (r: ReturnType<typeof candidateScales>) =>
  r.candidates.map((c) => c.name);

describe('candidateScales', () => {
  // A C D E G
  const pentatonic = [5, 8, 10, 12, 15];

  it('is ambiguous between relative scales when nothing points to a centre', () => {
    // Ends on E: neither A nor C is favoured.
    const result = candidateScales({ analysis: lick(...pentatonic, 12) });
    expect(result.certainty).toBe('ambiguous');
    expect(names(result).slice(0, 2).sort()).toEqual([
      'A minor pentatonic',
      'C major pentatonic',
    ]);
  });

  it('uses the key the user gave, and says so', () => {
    const result = candidateScales({
      analysis: lick(...pentatonic, 12),
      key: parseKey('Am'),
    });
    expect(result.certainty).toBe('clear');
    expect(result.candidates[0]).toMatchObject({
      name: 'A minor pentatonic',
      notes: ['A', 'C', 'D', 'E', 'G'],
      outside: [],
    });
    expect(result.candidates[0].reasons).toContain(
      'matches the key you gave (A minor)',
    );
  });

  it('uses the chord the phrase is played over', () => {
    const result = candidateScales({
      analysis: lick(...pentatonic, 12),
      chords: [parseChord('C')!],
    });
    expect(result.candidates[0].name).toBe('C major pentatonic');
    expect(result.candidates[0].reasons).toContain('root of the first chord');
  });

  it('finds the blues scale when the b5 is used', () => {
    // A C D Eb E G, ending on A.
    const result = candidateScales({
      analysis: lick(5, 8, 10, 11, 12, 15, 17),
    });
    expect(result.candidates[0]).toMatchObject({
      name: 'A blues',
      notes: ['A', 'C', 'D', 'Eb', 'E', 'G'],
    });
    // Minor pentatonic still appears, with the Eb flagged as outside.
    const pent = result.candidates.find((c) => c.name === 'A minor pentatonic');
    expect(pent?.outside).toEqual(['Eb']);
    // Near misses on unrelated roots are noise and are left out.
    expect(
      candidateScales({ analysis: lick(5, 8, 10, 11, 12, 15, 12) })
        .candidates.filter((c) => c.outside.length)
        .map((c) => c.root),
    ).toEqual(expect.not.arrayContaining(['E']));
  });

  it('does not call a superset of the same root ambiguous', () => {
    const result = candidateScales({
      analysis: lick(...pentatonic, 17),
      key: parseKey('Am'),
    });
    expect(result.certainty).toBe('clear');
    expect(names(result)).toContain('A blues');
  });

  it('spells scales from their root in the key', () => {
    const result = candidateScales({
      // Bb C D Eb F G A: Bb major
      analysis: lick(6, 8, 10, 11, 13, 15, 17, 6),
      key: parseKey('Bb'),
    });
    expect(result.candidates[0]).toMatchObject({
      name: 'Bb major',
      notes: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
    });
  });

  it('says when there are too few notes to tell', () => {
    expect(candidateScales({ analysis: lick(5, 8, 5) }).certainty).toBe(
      'insufficient',
    );
    expect(candidateScales({ analysis: lick() })).toEqual({
      certainty: 'insufficient',
      candidates: [],
    });
  });
});
