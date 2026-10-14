import {
  compactOrder,
  EventLike,
  groupByOrder,
  validateEvents,
} from './validate-events';

const rules = { stringCount: 6, capo: 0, rhythmKnown: false };
const ev = (patch: Partial<EventLike> = {}): EventLike => ({
  id: 'e1',
  order: 0,
  stringIndex: 0,
  fret: 5,
  durationTicks: null,
  techniques: [],
  ...patch,
});
const codes = (events: EventLike[], r = rules) =>
  validateEvents(events, r).map((i) => i.code);

describe('validateEvents', () => {
  it('accepts a valid phrase with a chord', () => {
    expect(
      codes([
        ev(),
        ev({ id: 'e2', stringIndex: 1 }),
        ev({ id: 'e3', order: 1, fret: 7 }),
      ]),
    ).toEqual([]);
  });

  it('flags duplicate ids', () => {
    expect(codes([ev(), ev({ stringIndex: 1 })])).toEqual(['duplicate-id']);
  });

  it('flags strings that do not exist', () => {
    expect(codes([ev({ stringIndex: 6 })])).toEqual(['string-out-of-range']);
  });

  it('flags frets beyond 24 including capo', () => {
    expect(codes([ev({ fret: 22 })], { ...rules, capo: 3 })).toEqual([
      'fret-out-of-range',
    ]);
  });

  it('requires a fret unless dead note, and forbids one on dead notes', () => {
    expect(codes([ev({ fret: null })])).toEqual(['missing-fret']);
    expect(codes([ev({ fret: null, techniques: ['dead-note'] })])).toEqual([]);
    expect(codes([ev({ techniques: ['dead-note'] })])).toEqual([
      'dead-note-with-fret',
    ]);
  });

  it('flags two simultaneous notes on one string', () => {
    expect(codes([ev(), ev({ id: 'e2', fret: 7 })])).toEqual([
      'string-collision',
    ]);
  });

  it('requires bend amounts only on bends', () => {
    expect(codes([ev({ techniques: ['bend'] })])).toEqual([
      'bend-without-amount',
    ]);
    expect(codes([ev({ techniques: ['bend'], bendSemitones: 2 })])).toEqual([]);
    expect(codes([ev({ bendSemitones: 1 })])).toEqual(['amount-without-bend']);
  });

  it('never allows durations when rhythm is unknown', () => {
    expect(codes([ev({ durationTicks: 240 })])).toEqual([
      'duration-when-rhythm-unknown',
    ]);
  });

  it('requires durations when rhythm is known', () => {
    expect(codes([ev()], { ...rules, rhythmKnown: true })).toEqual([
      'missing-duration',
    ]);
    expect(
      codes([ev({ durationTicks: 240 })], { ...rules, rhythmKnown: true }),
    ).toEqual([]);
  });
});

describe('groupByOrder / compactOrder', () => {
  it('groups simultaneous events sorted by string', () => {
    const groups = groupByOrder([
      ev({ id: 'a', order: 5, stringIndex: 2 }),
      ev({ id: 'b', order: 1 }),
      ev({ id: 'c', order: 5, stringIndex: 0 }),
    ]);
    expect(groups.map((g) => g.map((e) => e.id))).toEqual([['b'], ['c', 'a']]);
  });

  it('compacts sparse orders', () => {
    expect(
      compactOrder([
        ev({ order: 10 }),
        ev({ id: 'b', order: 3 }),
        ev({ id: 'c', order: 10, stringIndex: 1 }),
      ]).map((e) => e.order),
    ).toEqual([1, 0, 1]);
  });
});
