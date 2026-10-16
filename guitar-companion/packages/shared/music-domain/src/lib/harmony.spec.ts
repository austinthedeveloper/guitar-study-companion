import { analyzeNotes } from './analyze-notes';
import { formatRoles, harmonize } from './harmony';
import { STANDARD_TUNING_MIDI } from './pitch';

// E5 bent a whole step to F#5, then G5.
const analysis = analyzeNotes({
  events: [
    {
      id: 'a',
      order: 0,
      stringIndex: 1,
      fret: 17,
      durationTicks: null,
      techniques: ['bend'],
      bendSemitones: 2,
    },
    {
      id: 'b',
      order: 1,
      stringIndex: 0,
      fret: 15,
      durationTicks: null,
      techniques: [],
    },
  ],
  tuningMidi: STANDARD_TUNING_MIDI,
});

describe('harmonize', () => {
  it('assumes a lone chord and labels notes and bend targets', () => {
    const h = harmonize({ analysis, chords: 'E7' });
    expect(h.assumed).toBe(true);
    expect(h.columnChords).toEqual(['E7', 'E7']);
    expect(h.roles['a']).toEqual({
      note: { label: 'R', chordTone: true },
      bendTo: { label: '2', chordTone: false },
    });
    expect(h.chords.map((c) => c.symbol)).toEqual(['E7']);
  });

  it('uses placed chords in order and nothing is assumed', () => {
    const h = harmonize({
      analysis,
      chords: 'E7 A7',
      chordChanges: [
        { fromOrder: 1, chord: 'A7' },
        { fromOrder: 0, chord: 'E7' },
      ],
    });
    expect(h.assumed).toBe(false);
    expect(h.columnChords).toEqual(['E7', 'A7']);
    expect(h.roles['b'].note).toEqual({ label: 'b7', chordTone: true });
  });

  it('gives no roles without placement or with unknown chords', () => {
    expect(harmonize({ analysis, chords: 'E7 A7' })).toMatchObject({
      assumed: false,
      roles: {},
      chords: [],
    });
    expect(harmonize({ analysis, chords: 'Xyz' }).roles).toEqual({});
  });
});

describe('formatRoles', () => {
  it('shows a bend as start→target and nothing without a role', () => {
    const r = (label: string) => ({ label, chordTone: true });
    expect(formatRoles({ note: r('b7'), bendTo: r('R') })).toBe('b7→R');
    expect(formatRoles({ note: r('3'), bendTo: null })).toBe('3');
    expect(formatRoles({ note: null, bendTo: null })).toBeNull();
    expect(formatRoles(undefined)).toBeNull();
  });
});
