import { MAX_FRET } from './pitch';

/** Structural subset of a tab event; kept local so music-domain has no dependencies. */
export interface EventLike {
  id: string;
  order: number;
  stringIndex: number;
  fret: number | null;
  durationTicks: number | null;
  techniques: readonly string[];
  bendSemitones?: number;
}

export interface PhraseRules {
  stringCount: number;
  capo: number;
  rhythmKnown: boolean;
}

export interface EventIssue {
  eventId: string | null;
  code:
    | 'duplicate-id'
    | 'string-out-of-range'
    | 'fret-out-of-range'
    | 'missing-fret'
    | 'dead-note-with-fret'
    | 'string-collision'
    | 'bend-without-amount'
    | 'amount-without-bend'
    | 'duration-when-rhythm-unknown'
    | 'missing-duration';
  message: string;
}

const BEND_TECHNIQUES = ['bend', 'pre-bend'];

/**
 * Deterministic checks for tab events (AI_CONTRACTS "Validation and
 * safety"). Returns every issue rather than throwing so the UI can show
 * them inline and the API can drop only the offending events.
 */
export function validateEvents(
  events: readonly EventLike[],
  rules: PhraseRules,
): EventIssue[] {
  const issues: EventIssue[] = [];
  const seenIds = new Set<string>();
  const occupied = new Map<string, string>();

  for (const e of events) {
    if (seenIds.has(e.id))
      issues.push({
        eventId: e.id,
        code: 'duplicate-id',
        message: `Duplicate event id "${e.id}"`,
      });
    seenIds.add(e.id);

    if (e.stringIndex < 0 || e.stringIndex >= rules.stringCount) {
      issues.push({
        eventId: e.id,
        code: 'string-out-of-range',
        message: `String ${e.stringIndex + 1} does not exist on a ${rules.stringCount}-string instrument`,
      });
    }

    const dead = e.techniques.includes('dead-note');
    if (e.fret === null && !dead) {
      issues.push({
        eventId: e.id,
        code: 'missing-fret',
        message: 'Fret is required unless the note is a dead note (x)',
      });
    }
    if (e.fret !== null && dead) {
      issues.push({
        eventId: e.id,
        code: 'dead-note-with-fret',
        message: 'Dead notes (x) have no fret',
      });
    }
    if (e.fret !== null && (e.fret < 0 || e.fret + rules.capo > MAX_FRET)) {
      issues.push({
        eventId: e.id,
        code: 'fret-out-of-range',
        message: `Fret ${e.fret}${rules.capo ? ` with capo ${rules.capo}` : ''} exceeds fret ${MAX_FRET}`,
      });
    }

    const key = `${e.order}:${e.stringIndex}`;
    const other = occupied.get(key);
    if (other !== undefined) {
      issues.push({
        eventId: e.id,
        code: 'string-collision',
        message: `Two notes on string ${e.stringIndex + 1} at the same time (with "${other}")`,
      });
    } else {
      occupied.set(key, e.id);
    }

    const bends = e.techniques.some((t) => BEND_TECHNIQUES.includes(t));
    if (bends && e.bendSemitones === undefined) {
      issues.push({
        eventId: e.id,
        code: 'bend-without-amount',
        message: 'Bends need an amount (e.g. ½ or full)',
      });
    }
    if (!bends && e.bendSemitones !== undefined) {
      issues.push({
        eventId: e.id,
        code: 'amount-without-bend',
        message: 'Bend amount set on a note without a bend',
      });
    }

    if (!rules.rhythmKnown && e.durationTicks !== null) {
      issues.push({
        eventId: e.id,
        code: 'duration-when-rhythm-unknown',
        message: 'Rhythm is marked unknown, so durations must be empty',
      });
    }
    if (rules.rhythmKnown && e.durationTicks === null) {
      issues.push({
        eventId: e.id,
        code: 'missing-duration',
        message: 'Rhythm is marked known, so every note needs a duration',
      });
    }
  }
  return issues;
}

/** Groups events into simultaneous slices sorted by order, then string. */
export function groupByOrder<T extends EventLike>(events: readonly T[]): T[][] {
  const groups = new Map<number, T[]>();
  for (const e of events)
    groups.set(e.order, [...(groups.get(e.order) ?? []), e]);
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, g]) => g.sort((a, b) => a.stringIndex - b.stringIndex));
}

/** Renumbers orders to 0..n-1 preserving sequence and simultaneity. */
export function compactOrder<T extends EventLike>(events: readonly T[]): T[] {
  const orders = [...new Set(events.map((e) => e.order))].sort((a, b) => a - b);
  const map = new Map(orders.map((o, i) => [o, i]));
  return events.map((e) => ({ ...e, order: map.get(e.order) ?? e.order }));
}
