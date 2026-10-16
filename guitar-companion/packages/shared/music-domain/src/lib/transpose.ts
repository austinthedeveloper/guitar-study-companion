import {
  NATURAL_HARMONICS,
  NoteAnalysis,
  soundingPitch,
} from './analyze-notes';
import { parseChord } from './chords';
import { neighbourOnString } from './editing';
import { Key, pitchClassOf, spellPitchClass } from './keys';
import { MAX_FRET } from './pitch';
import { EventLike } from './validate-events';

/**
 * Transposition (M4): every pitch moves by the same number of semitones, so
 * intervals are preserved exactly; then a fingering search finds playable
 * strings and frets for the new pitches. Nothing here is AI.
 */

export type OctaveChoice = 'nearest' | 'up' | 'down';

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Semitones from one key to another, picking the octave by `choice`. */
export function transposeSemitones(
  from: Key,
  to: Key,
  choice: OctaveChoice = 'nearest',
): number {
  const up = mod12(to.tonicPc - from.tonicPc);
  if (choice === 'up') return up;
  if (choice === 'down') return up === 0 ? 0 : up - 12;
  return up > 6 ? up - 12 : up;
}

/**
 * Moves a chord symbol by `semitones`, keeping its quality text and
 * spelling the new root (and slash bass) in the target key. Unknown
 * symbols come back unchanged with `understood: false`.
 */
export function transposeChord(
  symbol: string,
  semitones: number,
  key?: Key | null,
): { symbol: string; understood: boolean } {
  const chord = parseChord(symbol);
  if (!chord) return { symbol, understood: false };
  if (chord.rootPc === null) return { symbol, understood: true };
  const m = /^([A-G](?:#|b|♯|♭)?)([^/]*)(?:\/([A-G](?:#|b|♯|♭)?))?$/.exec(
    symbol.trim(),
  );
  if (!m) return { symbol, understood: false };
  const spell = (note: string) =>
    spellPitchClass(
      (pitchClassOf(note.replace('♯', '#').replace('♭', 'b')) ?? 0) + semitones,
      key,
    );
  return {
    symbol: `${spell(m[1])}${m[2]}${m[3] ? `/${spell(m[3])}` : ''}`,
    understood: true,
  };
}

/** Transposes every symbol in a free-text progression, keeping separators. */
export function transposeProgression(
  text: string | undefined,
  semitones: number,
  key?: Key | null,
): string | undefined {
  if (!text) return text;
  return text.replace(/[^\s|,]+/g, (token) =>
    /^[:|%]+$/.test(token)
      ? token
      : transposeChord(token, semitones, key).symbol,
  );
}

export interface FingeringOptions {
  tuningMidi: readonly number[];
  capo: number;
  /** Highest fret the player wants to use (counted from the nut). */
  maxFret: number;
  /**
   * Preferred hand position: the lowest fret of a four-fret window
   * (0 = open position). Null lets the search keep the original shape.
   */
  position: number | null;
}

export interface TransposeResult {
  /** Same ids as the original, with new string/fret; null when impossible. */
  events: EventLike[] | null;
  semitones: number;
  /** Why no fingering exists, when events is null. */
  problem?: string;
}

/** Largest fret span one hand can hold in a single chord (as in plan review). */
const MAX_STRETCH = 5;
const MAX_CANDIDATES = 8;

interface Placement {
  id: string;
  stringIndex: number;
  fret: number | null;
}
type ColumnChoice = Placement[];

/**
 * Transposes a verified phrase by `semitones` and finds the fingering with
 * the least hand movement that keeps slurs and slides on one string, never
 * bends an open string, stays within reach in chords, and respects the
 * preferred position and highest fret.
 */
export function transposePhrase(
  events: readonly EventLike[],
  analysis: NoteAnalysis,
  semitones: number,
  options: FingeringOptions,
): TransposeResult {
  const { tuningMidi, capo, maxFret, position } = options;
  const byId = new Map(events.map((e) => [e.id, e]));
  const highest = Math.min(maxFret, MAX_FRET) - capo;
  const stepOf = new Map(
    analysis.columns.flatMap((c, i) => c.notes.map((n) => [n.eventId, i + 1])),
  );

  // Notes that must share a string with a neighbour: slur targets with
  // their source, slide starts with their landing note.
  const sameString = new Map<string, string>();
  for (const e of events) {
    if (e.techniques.some((t) => t === 'hammer-on' || t === 'pull-off')) {
      const prev = neighbourOnString(events, e, -1);
      if (prev) sameString.set(e.id, prev.id);
    }
    if (e.techniques.includes('slide')) {
      const next = neighbourOnString(events, e, 1);
      if (next) sameString.set(next.id, e.id);
    }
  }

  // Candidate placements for every column.
  const columns: ColumnChoice[][] = [];
  for (const col of analysis.columns) {
    const options: Placement[][] = [];
    for (const n of col.notes) {
      const e = byId.get(n.eventId);
      if (!e) continue;
      if (n.midi === null || n.dead) {
        // Dead notes have no pitch: keep them on their string.
        options.push([{ id: e.id, stringIndex: e.stringIndex, fret: null }]);
        continue;
      }
      const target = n.midi + semitones;
      const bent =
        e.techniques.includes('bend') || e.techniques.includes('pre-bend');
      const harmonic = e.techniques.includes('harmonic');
      const places: Placement[] = [];
      tuningMidi.forEach((open, s) => {
        if (harmonic) {
          // Natural harmonics only exist at fixed nodes above the open string.
          for (const [node, above] of Object.entries(NATURAL_HARMONICS))
            if (open + capo + above === target && Number(node) <= highest)
              places.push({ id: e.id, stringIndex: s, fret: Number(node) });
          return;
        }
        const fret = target - open - capo;
        if (fret < 0 || fret > highest) return;
        if (bent && fret === 0) return;
        places.push({ id: e.id, stringIndex: s, fret });
      });
      if (!places.length) {
        const name = n.name ?? `note ${stepOf.get(e.id)}`;
        return {
          events: null,
          semitones,
          problem: `Note ${stepOf.get(e.id)} (${name} moved by ${semitones} semitones) can't be played${
            harmonic ? ' as a natural harmonic' : ''
          } on this tuning within fret ${maxFret}. Try the other octave or a higher fret limit.`,
        };
      }
      // Prefer the original string, then nearby ones.
      places.sort(
        (a, b) =>
          Math.abs(a.stringIndex - e.stringIndex) -
          Math.abs(b.stringIndex - e.stringIndex),
      );
      options.push(places.slice(0, MAX_CANDIDATES));
    }
    columns.push(combine(options));
    if (!columns[columns.length - 1].length)
      return {
        events: null,
        semitones,
        problem: `The notes at position ${columns.length} can't be fretted together within reach.`,
      };
  }

  // Least-cost path through the columns (Viterbi).
  const handOf = (c: ColumnChoice) => {
    const fretted = c.flatMap((p) => (p.fret ? [p.fret] : []));
    return fretted.length ? Math.min(...fretted) : null;
  };
  const columnCost = (c: ColumnChoice) =>
    c.reduce((sum, p) => {
      const original = byId.get(p.id);
      let cost = original
        ? Math.abs(p.stringIndex - original.stringIndex) * 0.4
        : 0;
      if (position !== null && p.fret !== null) {
        if (p.fret === 0) cost += position <= 3 ? 0 : 2;
        else if (p.fret < position) cost += (position - p.fret) * 1.5;
        else if (p.fret > position + 4) cost += (p.fret - position - 4) * 1.5;
      }
      return cost + (p.fret ?? 0) * 0.02;
    }, 0);
  const linkOk = (prev: ColumnChoice, next: ColumnChoice) =>
    next.every((p) => {
      const partner = sameString.get(p.id);
      if (!partner) return true;
      const q = prev.find((x) => x.id === partner);
      return !q || q.stringIndex === p.stringIndex;
    });
  const move = (prev: ColumnChoice, next: ColumnChoice) => {
    const a = handOf(prev);
    const b = handOf(next);
    // Within a four-fret span (one finger per fret) the hand doesn't move.
    return a === null || b === null ? 0 : Math.max(0, Math.abs(a - b) - 3);
  };

  if (!columns.length) return { events: [], semitones };
  let costs = columns[0].map(columnCost);
  const back: number[][] = [columns[0].map(() => -1)];
  for (let i = 1; i < columns.length; i++) {
    const next: number[] = [];
    const from: number[] = [];
    columns[i].forEach((c) => {
      let best = Infinity;
      let arg = -1;
      columns[i - 1].forEach((p, j) => {
        if (!Number.isFinite(costs[j]) || !linkOk(p, c)) return;
        const total = costs[j] + move(p, c);
        if (total < best) {
          best = total;
          arg = j;
        }
      });
      next.push(best + columnCost(c));
      from.push(arg);
    });
    costs = next;
    back.push(from);
  }
  let k = costs.indexOf(Math.min(...costs));
  if (!Number.isFinite(costs[k]))
    return {
      events: null,
      semitones,
      problem:
        'No fingering keeps every slur and slide on one string within these limits. Try another position or a higher fret limit.',
    };
  const chosen: ColumnChoice[] = [];
  for (let i = columns.length - 1; i >= 0; i--) {
    chosen.unshift(columns[i][k]);
    k = back[i][k];
  }
  const placed = new Map(chosen.flat().map((p) => [p.id, p]));
  return {
    semitones,
    events: events.map((e) => {
      const p = placed.get(e.id);
      return p ? { ...e, stringIndex: p.stringIndex, fret: p.fret } : { ...e };
    }),
  };
}

/** Every way to place a column's notes on distinct strings within reach. */
function combine(options: Placement[][]): ColumnChoice[] {
  let out: ColumnChoice[] = [[]];
  for (const opts of options) {
    const next: ColumnChoice[] = [];
    for (const partial of out)
      for (const p of opts) {
        if (partial.some((q) => q.stringIndex === p.stringIndex)) continue;
        const choice = [...partial, p];
        const fretted = choice.flatMap((q) => (q.fret ? [q.fret] : []));
        if (
          fretted.length &&
          Math.max(...fretted) - Math.min(...fretted) > MAX_STRETCH
        )
          continue;
        next.push(choice);
      }
    out = next.slice(0, 64);
  }
  return out;
}

export interface TranspositionIssue {
  eventId: string | null;
  message: string;
}

/**
 * Independent check of a transposed phrase against the original: same
 * notes and order, every interval preserved, frets on the neck and within
 * the limit, slurs and slides still on one string, no open-string bends,
 * chords within reach.
 */
export function validateTransposition(input: {
  original: readonly EventLike[];
  transposed: readonly EventLike[];
  semitones: number;
  tuningMidi: readonly number[];
  capo: number;
  maxFret: number;
}): TranspositionIssue[] {
  const { original, transposed, semitones, tuningMidi, capo, maxFret } = input;
  const issues: TranspositionIssue[] = [];
  const after = new Map(transposed.map((e) => [e.id, e]));
  const pitch = (e: EventLike) => soundingPitch(e, tuningMidi, capo);
  for (const o of original) {
    const t = after.get(o.id);
    if (!t) {
      issues.push({ eventId: o.id, message: 'A note went missing.' });
      continue;
    }
    if (t.order !== o.order || t.techniques.join() !== o.techniques.join())
      issues.push({ eventId: o.id, message: 'Order or technique changed.' });
    if (t.bendSemitones !== o.bendSemitones)
      issues.push({ eventId: o.id, message: 'Bend amount changed.' });
    if (t.stringIndex < 0 || t.stringIndex >= tuningMidi.length)
      issues.push({
        eventId: o.id,
        message: 'On a string that does not exist.',
      });
    if (
      t.fret !== null &&
      (t.fret < 0 || t.fret + capo > Math.min(maxFret, MAX_FRET))
    )
      issues.push({
        eventId: o.id,
        message: `Fret ${t.fret} is past the limit.`,
      });
    const a = pitch(o);
    const b = pitch(t);
    if (
      (a === null) !== (b === null) ||
      (a !== null && b !== null && b - a !== semitones)
    )
      issues.push({
        eventId: o.id,
        message: `Moved by ${a !== null && b !== null ? b - a : '?'} semitones instead of ${semitones}.`,
      });
    if (
      t.fret === 0 &&
      (t.techniques.includes('bend') || t.techniques.includes('pre-bend'))
    )
      issues.push({ eventId: o.id, message: "An open string can't be bent." });
    if (t.techniques.some((x) => x === 'hammer-on' || x === 'pull-off')) {
      const src = neighbourOnString(original, o, -1);
      const srcAfter = src && after.get(src.id);
      if (srcAfter && srcAfter.stringIndex !== t.stringIndex)
        issues.push({
          eventId: o.id,
          message: 'Slur no longer on one string.',
        });
    }
    if (t.techniques.includes('slide')) {
      const dst = neighbourOnString(original, o, 1);
      const dstAfter = dst && after.get(dst.id);
      if (dstAfter && dstAfter.stringIndex !== t.stringIndex)
        issues.push({
          eventId: o.id,
          message: 'Slide no longer on one string.',
        });
    }
  }
  const byOrder = new Map<number, EventLike[]>();
  for (const t of transposed)
    byOrder.set(t.order, [...(byOrder.get(t.order) ?? []), t]);
  for (const col of byOrder.values()) {
    const strings = col.map((t) => t.stringIndex);
    if (new Set(strings).size !== strings.length)
      issues.push({
        eventId: null,
        message: 'Two notes on one string at once.',
      });
    const fretted = col.flatMap((t) => (t.fret ? [t.fret] : []));
    if (
      fretted.length &&
      Math.max(...fretted) - Math.min(...fretted) > MAX_STRETCH
    )
      issues.push({ eventId: null, message: 'A chord is out of reach.' });
  }
  return issues;
}
