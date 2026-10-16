import { Key, pitchClassOf, spellPitchClass } from './keys';

/**
 * Chord symbols as the user typed them. Only symbols we can parse become
 * chords; anything else stays text and is reported as not understood
 * rather than guessed (AI_CONTRACTS: no unknown labels masquerading as facts).
 */

export interface ChordTone {
  /** Semitones above the root, 0..11. */
  offset: number;
  /** Function in this chord: "R", "b3", "5", "b7", "#9", ... */
  label: string;
}

export interface Chord {
  /** Symbol as written, trimmed. */
  symbol: string;
  /** Null for "N.C." (no chord). */
  rootPc: number | null;
  root: string | null;
  bassPc: number | null;
  tones: ChordTone[];
}

const t = (...pairs: [number, string][]): ChordTone[] =>
  pairs.map(([offset, label]) => ({ offset, label }));
const MAJOR = t([0, 'R'], [4, '3'], [7, '5']);
const MINOR = t([0, 'R'], [3, 'b3'], [7, '5']);

/** Quality suffix -> chord tones. Aliases share an entry. */
const QUALITIES: Record<string, ChordTone[]> = {
  '': MAJOR,
  maj: MAJOR,
  M: MAJOR,
  m: MINOR,
  min: MINOR,
  '-': MINOR,
  '5': t([0, 'R'], [7, '5']),
  '6': [...MAJOR, ...t([9, '6'])],
  m6: [...MINOR, ...t([9, '6'])],
  '7': [...MAJOR, ...t([10, 'b7'])],
  maj7: [...MAJOR, ...t([11, '7'])],
  M7: [...MAJOR, ...t([11, '7'])],
  Δ: [...MAJOR, ...t([11, '7'])],
  Δ7: [...MAJOR, ...t([11, '7'])],
  m7: [...MINOR, ...t([10, 'b7'])],
  min7: [...MINOR, ...t([10, 'b7'])],
  '-7': [...MINOR, ...t([10, 'b7'])],
  mMaj7: [...MINOR, ...t([11, '7'])],
  'm(maj7)': [...MINOR, ...t([11, '7'])],
  dim: t([0, 'R'], [3, 'b3'], [6, 'b5']),
  '°': t([0, 'R'], [3, 'b3'], [6, 'b5']),
  dim7: t([0, 'R'], [3, 'b3'], [6, 'b5'], [9, 'bb7']),
  '°7': t([0, 'R'], [3, 'b3'], [6, 'b5'], [9, 'bb7']),
  m7b5: t([0, 'R'], [3, 'b3'], [6, 'b5'], [10, 'b7']),
  ø: t([0, 'R'], [3, 'b3'], [6, 'b5'], [10, 'b7']),
  ø7: t([0, 'R'], [3, 'b3'], [6, 'b5'], [10, 'b7']),
  aug: t([0, 'R'], [4, '3'], [8, '#5']),
  '+': t([0, 'R'], [4, '3'], [8, '#5']),
  '7#5': t([0, 'R'], [4, '3'], [8, '#5'], [10, 'b7']),
  aug7: t([0, 'R'], [4, '3'], [8, '#5'], [10, 'b7']),
  '+7': t([0, 'R'], [4, '3'], [8, '#5'], [10, 'b7']),
  sus2: t([0, 'R'], [2, '2'], [7, '5']),
  sus4: t([0, 'R'], [5, '4'], [7, '5']),
  sus: t([0, 'R'], [5, '4'], [7, '5']),
  '7sus4': t([0, 'R'], [5, '4'], [7, '5'], [10, 'b7']),
  add9: [...MAJOR, ...t([2, '9'])],
  madd9: [...MINOR, ...t([2, '9'])],
  '9': [...MAJOR, ...t([10, 'b7'], [2, '9'])],
  maj9: [...MAJOR, ...t([11, '7'], [2, '9'])],
  m9: [...MINOR, ...t([10, 'b7'], [2, '9'])],
  '7b9': [...MAJOR, ...t([10, 'b7'], [1, 'b9'])],
  '7#9': [...MAJOR, ...t([10, 'b7'], [3, '#9'])],
  '11': [...MAJOR, ...t([10, 'b7'], [2, '9'], [5, '11'])],
  m11: [...MINOR, ...t([10, 'b7'], [2, '9'], [5, '11'])],
  '13': [...MAJOR, ...t([10, 'b7'], [2, '9'], [9, '13'])],
};

/** How a pitch relates to a root when it isn't one of the chord's tones. */
const OTHER_LABELS = [
  'R',
  'b2',
  '2',
  'b3',
  '3',
  '4',
  'b5',
  '5',
  'b6',
  '6',
  'b7',
  '7',
];

const NO_CHORD = /^(N\.?C\.?|n\.?c\.?)$/;

/** Parses one chord symbol ("D/F#", "Bm7b5", "N.C."), or null if not understood. */
export function parseChord(text: string): Chord | null {
  const symbol = text.trim();
  if (NO_CHORD.test(symbol))
    return { symbol, rootPc: null, root: null, bassPc: null, tones: [] };
  const m = /^([A-G])(#|b|♯|♭)?([^/]*)(?:\/([A-G](?:#|b|♯|♭)?))?$/.exec(symbol);
  if (!m) return null;
  const root = m[1] + (m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : (m[2] ?? ''));
  const tones = QUALITIES[m[3]];
  if (!tones) return null;
  const rootPc = pitchClassOf(root);
  const bassPc = m[4]
    ? pitchClassOf(m[4].replace('♯', '#').replace('♭', 'b'))
    : rootPc;
  if (rootPc === null || bassPc === null) return null;
  return { symbol, rootPc, root, bassPc, tones };
}

export interface ProgressionItem {
  text: string;
  chord: Chord | null;
}

/** Splits free-text chord context ("G D/F# | Em C") into symbols, parsing each. */
export function parseProgression(text: string | undefined): ProgressionItem[] {
  return (text ?? '')
    .split(/[\s|,]+/)
    .filter((s) => s && !/^[:|%]+$/.test(s))
    .map((s) => ({ text: s, chord: parseChord(s) }));
}

export interface NoteRole {
  /** Function relative to the chord root, e.g. "b3", "5", "9". */
  label: string;
  chordTone: boolean;
}

/** A pitch's role over a chord; null over "N.C.". */
export function noteRole(midi: number, chord: Chord): NoteRole | null {
  if (chord.rootPc === null) return null;
  const offset = (((midi - chord.rootPc) % 12) + 12) % 12;
  const tone = chord.tones.find((x) => x.offset === offset);
  return tone
    ? { label: tone.label, chordTone: true }
    : { label: OTHER_LABELS[offset], chordTone: false };
}

/**
 * Chord tones spelled from the chord's own root, e.g. A7 -> A C# E G and
 * Cm7 -> C Eb G Bb (minor-third chords spell from the minor key).
 */
export function chordToneNames(chord: Chord): string[] {
  if (chord.rootPc === null || chord.root === null) return [];
  const rootPc = chord.rootPc;
  const minor = chord.tones.some((x) => x.label === 'b3');
  const key: Key = {
    tonic: chord.root,
    tonicPc: rootPc,
    mode: minor ? 'minor' : 'major',
  };
  return chord.tones.map((x) => spellPitchClass(rootPc + x.offset, key));
}

/** "From this column on, the band plays this chord." */
export interface ChordChange {
  fromOrder: number;
  chord: string;
}

/** The chord symbol in effect at a column, or null before the first change. */
export function chordAt(
  changes: readonly ChordChange[],
  order: number,
): string | null {
  let current: ChordChange | null = null;
  for (const c of changes)
    if (c.fromOrder <= order && (!current || c.fromOrder >= current.fromOrder))
      current = c;
  return current?.chord ?? null;
}

/**
 * Placement to assume when the user hasn't placed chords: with exactly one
 * understood chord, the whole phrase is over it. Otherwise nothing is
 * assumed, because which notes fall under which chord can't be read from tab.
 */
export function assumedChordChanges(
  progression: readonly ProgressionItem[],
): ChordChange[] {
  const understood = progression.filter((p) => p.chord);
  return understood.length === 1 && progression.length === 1
    ? [{ fromOrder: 0, chord: understood[0].text }]
    : [];
}
