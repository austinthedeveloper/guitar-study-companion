import {
  deleteSlice,
  describeMoves,
  insertSliceBefore,
  moveSlice,
  neighbourOnString,
  nextEventId,
  setNote,
  sliceOrders,
  updateEvent,
} from './editing';
import { EventLike } from './validate-events';

const ev = (
  id: string,
  order: number,
  stringIndex = 0,
  fret: number | null = 5,
): EventLike => ({
  id,
  order,
  stringIndex,
  fret,
  durationTicks: null,
  techniques: [],
});
const make = (id: string): EventLike => ev(id, 0);

describe('tab editing', () => {
  const base = [ev('e1', 0), ev('e2', 1), ev('e3', 1, 1, 7), ev('e9', 2)];

  it('generates the next id', () => {
    expect(nextEventId(base)).toBe('e10');
    expect(nextEventId([])).toBe('e1');
  });

  it('sets, adds, and clears notes', () => {
    expect(setNote(base, 0, 0, 8, make).find((e) => e.id === 'e1')?.fret).toBe(
      8,
    );
    const added = setNote(base, 0, 2, 3, make);
    expect(added.find((e) => e.id === 'e10')).toMatchObject({
      order: 0,
      stringIndex: 2,
      fret: 3,
    });
    expect(setNote(base, 1, 1, undefined, make).map((e) => e.id)).toEqual([
      'e1',
      'e2',
      'e9',
    ]);
  });

  it('inserts, deletes, and moves columns', () => {
    expect(sliceOrders(insertSliceBefore(base, 1))).toEqual([0, 2, 3]);
    expect(deleteSlice(base, 1).map((e) => [e.id, e.order])).toEqual([
      ['e1', 0],
      ['e9', 1],
    ]);
    expect(moveSlice(base, 1, -1).map((e) => [e.id, e.order])).toEqual([
      ['e1', 1],
      ['e2', 0],
      ['e3', 0],
      ['e9', 2],
    ]);
    expect(moveSlice(base, 0, -1)).toEqual(base);
  });

  it('updates a single event', () => {
    expect(
      updateEvent(base, 'e2', { techniques: ['vibrato'] }).find(
        (e) => e.id === 'e2',
      )?.techniques,
    ).toEqual(['vibrato']);
  });
});

describe('describeMoves', () => {
  const at = (
    id: string,
    order: number,
    fret: number,
    techniques: string[] = [],
  ) => ({
    id,
    order,
    stringIndex: 4,
    fret,
    durationTicks: null,
    techniques,
  });
  const events = [
    at('a', 0, 6, ['slide']),
    at('b', 1, 5),
    at('c', 2, 3, ['pull-off']),
    at('d', 3, 0, ['pull-off']),
    { ...at('e', 1, 7), stringIndex: 3 },
  ];

  it('spells out slides from their start and slurs into their note', () => {
    expect(events.map((e) => describeMoves(events, e))).toEqual([
      ['slide from fret 6 to fret 5'],
      [],
      ['pull-off from fret 5 to fret 3'],
      ['pull-off from fret 3 to the open string'],
      [],
    ]);
  });

  it('finds neighbours on the same string only', () => {
    expect(neighbourOnString(events, events[1], -1)?.id).toBe('a');
    expect(neighbourOnString(events, events[1], 1)?.id).toBe('c');
    expect(neighbourOnString(events, events[4], 1)).toBeUndefined();
  });
});
