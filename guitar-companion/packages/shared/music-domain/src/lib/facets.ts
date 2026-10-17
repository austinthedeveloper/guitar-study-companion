import { analyzeNotes, intervalName } from './analyze-notes';
import { formatKey, parseKey } from './keys';
import { EventLike } from './validate-events';

/**
 * Searchable facts about a phrase, computed from its verified notes so
 * they can never drift from the music (M5 library).
 */
export interface PhraseFacets {
  /** "A minor"; null when no key was given or it wasn't understood. */
  key: string | null;
  techniques: string[];
  /** Melodic steps in order, e.g. "m3 up"; repeated notes are "P1". */
  steps: string[];
}

export function phraseFacets(input: {
  events: readonly EventLike[];
  tuningMidi: readonly number[];
  capo: number;
  key?: string;
}): PhraseFacets {
  const key = parseKey(input.key);
  const analysis = analyzeNotes({
    events: input.events,
    tuningMidi: input.tuningMidi,
    capo: input.capo,
    key,
  });
  return {
    key: key ? formatKey(key) : null,
    techniques: [...new Set(input.events.flatMap((e) => e.techniques))].sort(),
    steps: analysis.columns.flatMap((c) =>
      c.fromPrevious
        ? [
            c.fromPrevious.semitones === 0
              ? 'P1'
              : `${c.fromPrevious.name} ${c.fromPrevious.semitones > 0 ? 'up' : 'down'}`,
          ]
        : [],
    ),
  };
}

interface PatternStep {
  name: string;
  direction: 'up' | 'down' | null;
}

const KNOWN = new Set(Array.from({ length: 25 }, (_, n) => intervalName(n)));

/**
 * Parses an interval pattern such as "m3 down, M2 up" or "m3- M2+" (a
 * direction is optional). Returns null when a token isn't an interval.
 */
export function parseIntervalPattern(text: string): PatternStep[] | null {
  const tokens = text
    .replace(/↑|\+/g, ' up ')
    .replace(/↓|(?<=\w)-/g, ' down ')
    .split(/[\s,]+/)
    .filter(Boolean);
  const steps: PatternStep[] = [];
  for (const t of tokens) {
    if (t === 'up' || t === 'down') {
      const last = steps[steps.length - 1];
      if (!last || last.direction) return null;
      last.direction = t;
    } else if (KNOWN.has(t)) steps.push({ name: t, direction: null });
    else return null;
  }
  return steps.length ? steps : null;
}

/** True when the steps appear consecutively in the phrase's melody. */
export function matchesIntervalPattern(
  steps: readonly string[],
  pattern: readonly PatternStep[],
): boolean {
  const parsed = steps.map((s) => {
    const [name, direction] = s.split(' ');
    return { name, direction: direction ?? null };
  });
  for (let i = 0; i + pattern.length <= parsed.length; i++)
    if (
      pattern.every((p, j) => {
        const s = parsed[i + j];
        return (
          s.name === p.name &&
          (p.direction === null ||
            p.name === 'P1' ||
            s.direction === p.direction)
        );
      })
    )
      return true;
  return false;
}
