import { Key, spellMidi, spellPitchClass } from './keys';
import { MAX_FRET } from './pitch';
import { EventLike } from './validate-events';

/**
 * Deterministic note facts for a verified phrase: sounding pitch, spelling,
 * and intervals. Nothing here is inferred; harmony and key interpretation
 * live elsewhere and must be labelled as assumptions.
 */

export interface Interval {
  /** Signed: positive is up. */
  semitones: number;
  /** Quality and size, e.g. "m3", "P5", "TT", "M9". Direction not included. */
  name: string;
}

export interface NoteFact {
  eventId: string;
  /** Written as "x": muted, no pitch. */
  dead: boolean;
  /** Sounding pitch at the fret (or harmonic); null for dead notes and unknown harmonics. */
  midi: number | null;
  name: string | null;
  /** Pitch a bend or pre-bend reaches, when it is a whole number of semitones. */
  bendToMidi?: number;
  bendToName?: string;
}

export interface ColumnFact {
  order: number;
  /** Notes sounding together, lowest pitch first; dead notes last. */
  notes: NoteFact[];
  /** For two or more pitched notes: each upper note measured from the lowest. */
  chordIntervals: Interval[];
  /**
   * Melodic step from the previous single note (from its bend target, if it
   * was bent). Null at the start, after a chord, or when this is a chord.
   */
  fromPrevious: Interval | null;
}

export interface NoteAnalysis {
  columns: ColumnFact[];
  /** Lowest and highest sounding pitches (bend targets included). */
  range: { lowest: string; highest: string } | null;
  /** Distinct pitch classes, spelled, in order of first appearance. */
  pitchClasses: string[];
}

const SIMPLE_NAMES = [
  'P1',
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'TT',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
];
const COMPOUND_NAMES = [
  'P8',
  'm9',
  'M9',
  'm10',
  'M10',
  'P11',
  'A11',
  'P12',
  'm13',
  'M13',
  'm14',
  'M14',
  'P15',
];

/** Interval name by size alone (spelling-independent: an aug 2nd reads as m3). */
export function intervalName(semitones: number): string {
  const size = Math.abs(semitones);
  if (size < 12) return SIMPLE_NAMES[size];
  if (size <= 24) return COMPOUND_NAMES[size - 12];
  return `${size} semitones`;
}

/**
 * A column's step in words: "chord: P5", "m3 up", "same note", or null at
 * the start of a line.
 */
export function describeStep(
  fromPrevious: Interval | null,
  chordIntervals: readonly Interval[],
): string | null {
  if (chordIntervals.length)
    return `chord: ${chordIntervals.map((c) => c.name).join(', ')}`;
  if (!fromPrevious) return null;
  if (fromPrevious.semitones === 0) return 'same note';
  return `${fromPrevious.name} ${fromPrevious.semitones > 0 ? 'up' : 'down'}`;
}

export function interval(fromMidi: number, toMidi: number): Interval {
  const semitones = toMidi - fromMidi;
  return { semitones, name: intervalName(semitones) };
}

/** Semitones above the open string for natural harmonics at common nodes. */
const NATURAL_HARMONICS: Record<number, number> = {
  12: 12,
  7: 19,
  19: 19,
  5: 24,
  24: 24,
  4: 28,
  9: 28,
  16: 28,
};

function noteFact(
  e: EventLike,
  tuningMidi: readonly number[],
  capo: number,
  key: Key | null,
): NoteFact {
  const open = tuningMidi[e.stringIndex];
  let midi: number | null = null;
  if (e.fret !== null && open !== undefined && e.fret + capo <= MAX_FRET) {
    midi = e.techniques.includes('harmonic')
      ? NATURAL_HARMONICS[e.fret] !== undefined
        ? open + capo + NATURAL_HARMONICS[e.fret]
        : null
      : open + capo + e.fret;
  }
  const fact: NoteFact = {
    eventId: e.id,
    dead: e.fret === null,
    midi,
    name: midi === null ? null : spellMidi(midi, key),
  };
  const bent =
    e.techniques.includes('bend') || e.techniques.includes('pre-bend');
  if (
    midi !== null &&
    bent &&
    e.bendSemitones &&
    Number.isInteger(e.bendSemitones)
  ) {
    fact.bendToMidi = midi + e.bendSemitones;
    fact.bendToName = spellMidi(fact.bendToMidi, key);
  }
  return fact;
}

export function analyzeNotes(input: {
  events: readonly EventLike[];
  tuningMidi: readonly number[];
  capo?: number;
  key?: Key | null;
}): NoteAnalysis {
  const capo = input.capo ?? 0;
  const key = input.key ?? null;
  const byOrder = new Map<number, EventLike[]>();
  for (const e of input.events)
    byOrder.set(e.order, [...(byOrder.get(e.order) ?? []), e]);

  const columns: ColumnFact[] = [];
  const sounding: number[] = [];
  const pcs: number[] = [];
  let previous: number | null = null;

  for (const [order, events] of [...byOrder.entries()].sort(
    ([a], [b]) => a - b,
  )) {
    const notes = events
      .map((e) => noteFact(e, input.tuningMidi, capo, key))
      .sort((a, b) => (a.midi ?? Infinity) - (b.midi ?? Infinity));
    const pitched = notes.filter((n) => n.midi !== null);
    for (const n of pitched) {
      for (const m of [n.midi as number, n.bendToMidi]) {
        if (m === undefined) continue;
        sounding.push(m);
        if (!pcs.includes(m % 12)) pcs.push(m % 12);
      }
    }

    const lowest = pitched[0]?.midi ?? null;
    const chordIntervals =
      pitched.length > 1 && lowest !== null
        ? pitched.slice(1).map((n) => interval(lowest, n.midi as number))
        : [];
    let fromPrevious: Interval | null = null;
    if (pitched.length === 1) {
      const n = pitched[0];
      if (previous !== null)
        fromPrevious = interval(previous, n.midi as number);
      previous = n.bendToMidi ?? (n.midi as number);
    } else if (pitched.length > 1) {
      previous = null;
    }
    // Dead-note-only columns leave the melodic line untouched.

    columns.push({ order, notes, chordIntervals, fromPrevious });
  }

  return {
    columns,
    range: sounding.length
      ? {
          lowest: spellMidi(Math.min(...sounding), key),
          highest: spellMidi(Math.max(...sounding), key),
        }
      : null,
    pitchClasses: pcs.map((pc) => spellPitchClass(pc, key)),
  };
}
