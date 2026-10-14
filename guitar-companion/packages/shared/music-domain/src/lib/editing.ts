import { EventLike } from './validate-events';

/**
 * Pure editing operations for the tab correction grid. A "slice" is all
 * events sharing one `order` (one column of the tab).
 */

export function nextEventId(events: readonly EventLike[]): string {
  const max = events.reduce(
    (m, e) => Math.max(m, Number(/^e(\d+)$/.exec(e.id)?.[1] ?? 0)),
    0,
  );
  return `e${max + 1}`;
}

export function sliceOrders(events: readonly EventLike[]): number[] {
  return [...new Set(events.map((e) => e.order))].sort((a, b) => a - b);
}

/** Sets (or clears, with fret undefined) the note at a column/string. */
export function setNote<T extends EventLike>(
  events: readonly T[],
  order: number,
  stringIndex: number,
  fret: number | null | undefined,
  make: (id: string) => T,
): T[] {
  const existing = events.find(
    (e) => e.order === order && e.stringIndex === stringIndex,
  );
  if (fret === undefined) return events.filter((e) => e !== existing);
  if (existing) return events.map((e) => (e === existing ? { ...e, fret } : e));
  return [
    ...events,
    { ...make(nextEventId(events)), order, stringIndex, fret },
  ];
}

/** Inserts an empty column position before `atOrder` by shifting later events right. */
export function insertSliceBefore<T extends EventLike>(
  events: readonly T[],
  atOrder: number,
): T[] {
  return events.map((e) =>
    e.order >= atOrder ? { ...e, order: e.order + 1 } : e,
  );
}

export function deleteSlice<T extends EventLike>(
  events: readonly T[],
  order: number,
): T[] {
  return events
    .filter((e) => e.order !== order)
    .map((e) => (e.order > order ? { ...e, order: e.order - 1 } : e));
}

/** Swaps a column with its neighbour. */
export function moveSlice<T extends EventLike>(
  events: readonly T[],
  order: number,
  direction: -1 | 1,
): T[] {
  const orders = sliceOrders(events);
  const idx = orders.indexOf(order);
  const target = orders[idx + direction];
  if (idx < 0 || target === undefined) return [...events];
  return events.map((e) =>
    e.order === order
      ? { ...e, order: target }
      : e.order === target
        ? { ...e, order }
        : e,
  );
}

export function updateEvent<T extends EventLike>(
  events: readonly T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return events.map((e) => (e.id === id ? { ...e, ...patch } : e));
}
