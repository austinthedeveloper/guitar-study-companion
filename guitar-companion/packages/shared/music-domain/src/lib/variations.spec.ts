import { analyzeNotes } from './analyze-notes';
import { parseChord } from './chords';
import { harmonize } from './harmony';
import { parseKey } from './keys';
import { STANDARD_TUNING_MIDI } from './pitch';
import { EventLike } from './validate-events';
import {
  alternateEnding,
  applyOverProgression,
  holdTargets,
} from './variations';

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
// C4 C#4(h) E4 G4->A4 A4 | F#4 D4~ over A7 then D7.
const blues = [
  ev('e1', 0, 2, 5),
  ev('e2', 1, 2, 6, ['hammer-on']),
  ev('e3', 2, 1, 5),
  ev('e4', 3, 1, 8, ['bend'], 2),
  ev('e5', 4, 0, 5),
  ev('e6', 5, 1, 7),
  ev('e7', 6, 2, 7, ['vibrato']),
];
const analysis = analyzeNotes({
  events: blues,
  tuningMidi: STANDARD_TUNING_MIDI,
  key: parseKey('A'),
});
const base = {
  events: blues,
  analysis,
  tuningMidi: STANDARD_TUNING_MIDI,
  capo: 0,
  key: parseKey('A'),
};
const placed = harmonize({
  analysis,
  chords: 'A7 D7',
  chordChanges: [
    { fromOrder: 0, chord: 'A7' },
    { fromOrder: 5, chord: 'D7' },
  ],
});

describe('alternateEnding', () => {
  it('moves an ending already on the root to the 3rd, fingered nearby', () => {
    const { variation } = alternateEnding({ ...base, chord: parseChord('D7') });
    expect(variation).toMatchObject({
      kind: 'ending',
      title: 'Resolve to the 3rd of D7',
      description: 'Ends on F#4 (3 of D7) instead of D4.',
      changedEventIds: ['e7'],
    });
    expect(variation?.events[6]).toMatchObject({
      stringIndex: 1,
      fret: 7,
      techniques: ['vibrato'],
    });
    expect(variation?.events.slice(0, 6)).toEqual(blues.slice(0, 6));
  });

  it('resolves to the nearest root of another chord', () => {
    const { variation } = alternateEnding({ ...base, chord: parseChord('E7') });
    expect(variation?.description).toBe('Ends on E4 (R of E7) instead of D4.');
    expect(variation?.events[6]).toMatchObject({ stringIndex: 2, fret: 9 });
  });

  it('explains when it does not apply', () => {
    expect(alternateEnding({ ...base, chord: null })).toEqual({
      variation: null,
      reason: 'Needs a chord under the last note to choose an ending.',
    });
    expect(
      alternateEnding({ ...base, chord: parseChord('N.C.') }).reason,
    ).toMatch(/Needs a chord/);
  });
});

describe('holdTargets', () => {
  it('holds chord tones (where bends land) for two beats', () => {
    const { variation } = holdTargets({ ...base, roles: placed.roles });
    expect(variation?.description).toBe(
      'Holds chord tones for two beats (notes 2, 3, 4, 5, 6, 7); the rest get one beat each.',
    );
    expect(variation?.rhythmKnown).toBe(true);
    expect(variation?.events.map((e) => e.durationTicks)).toEqual([
      480, 960, 960, 960, 960, 960, 960,
    ]);
  });

  it('holds the end of each figure when there are no chords', () => {
    const { variation } = holdTargets({ ...base, roles: {} });
    expect(variation?.description).toBe(
      'Holds the last note of each figure for two beats (notes 4, 7); the rest get one beat each.',
    );
  });
});

describe('applyOverProgression', () => {
  it('scores the phrase over each chord and re-ends it there', () => {
    const result = applyOverProgression({ ...base, progression: 'A7 D7 Xyz' });
    expect(
      result.map((r) => [
        r.chord,
        r.understood,
        `${r.chordTones}/${r.pitchedNotes}`,
      ]),
    ).toEqual([
      ['A7', true, '4/7'],
      ['D7', true, '5/7'],
      ['Xyz', false, '0/0'],
    ]);
    expect(result[0].roles['e2'].note).toEqual({ label: '3', chordTone: true });
    // From D4 the nearest A is a 4th down (A3), not a 5th up.
    expect(result[0].ending.variation?.description).toBe(
      'Ends on A3 (R of A7) instead of D4.',
    );
    expect(result[2].ending.reason).toMatch(/isn't a chord symbol/);
  });
});
