import {
  matchesIntervalPattern,
  parseIntervalPattern,
  phraseFacets,
} from './facets';
import { STANDARD_TUNING_MIDI } from './pitch';

const ev = (
  order: number,
  stringIndex: number,
  fret: number,
  techniques: string[] = [],
) => ({
  id: `e${order}`,
  order,
  stringIndex,
  fret,
  durationTicks: null,
  techniques,
});

describe('phraseFacets', () => {
  it('lists key, techniques, and melodic steps from the notes', () => {
    // C4 C#4(h) E4 E4 C4: m2 up, m3 up, same, M3 down
    const facets = phraseFacets({
      events: [
        ev(0, 2, 5),
        ev(1, 2, 6, ['hammer-on']),
        ev(2, 1, 5, ['vibrato']),
        ev(3, 1, 5),
        ev(4, 2, 5),
      ],
      tuningMidi: STANDARD_TUNING_MIDI,
      capo: 0,
      key: 'am',
    });
    expect(facets).toEqual({
      key: 'A minor',
      techniques: ['hammer-on', 'vibrato'],
      steps: ['m2 up', 'm3 up', 'P1', 'M3 down'],
    });
  });

  it('has no key when it is missing or not understood', () => {
    expect(
      phraseFacets({
        events: [],
        tuningMidi: STANDARD_TUNING_MIDI,
        capo: 0,
        key: 'bluesy',
      }).key,
    ).toBeNull();
  });
});

describe('interval patterns', () => {
  const steps = ['m2 up', 'm3 up', 'P1', 'M3 down'];

  it('parses names with optional directions in several spellings', () => {
    expect(parseIntervalPattern('m3 down, M2 up')).toEqual([
      { name: 'm3', direction: 'down' },
      { name: 'M2', direction: 'up' },
    ]);
    expect(parseIntervalPattern('m3- M2+ P5')).toEqual([
      { name: 'm3', direction: 'down' },
      { name: 'M2', direction: 'up' },
      { name: 'P5', direction: null },
    ]);
    expect(parseIntervalPattern('m3↓')).toEqual([
      { name: 'm3', direction: 'down' },
    ]);
  });

  it('rejects things that are not intervals', () => {
    expect(parseIntervalPattern('third')).toBeNull();
    expect(parseIntervalPattern('up m3')).toBeNull();
    expect(parseIntervalPattern('')).toBeNull();
  });

  it('matches consecutive steps, with or without direction', () => {
    const p = (t: string) => parseIntervalPattern(t)!;
    expect(matchesIntervalPattern(steps, p('m2 up, m3 up'))).toBe(true);
    expect(matchesIntervalPattern(steps, p('m3'))).toBe(true);
    expect(matchesIntervalPattern(steps, p('m3 down'))).toBe(false);
    expect(matchesIntervalPattern(steps, p('m2 m3 P1 M3'))).toBe(true);
    // Not consecutive.
    expect(matchesIntervalPattern(steps, p('m2 P1'))).toBe(false);
  });
});
