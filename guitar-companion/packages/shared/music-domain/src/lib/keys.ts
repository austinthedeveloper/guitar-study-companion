/**
 * Keys and note spelling. A key is only ever what the user told us; it is
 * used to spell notes (C vs B#, Db vs C#), never inferred here.
 */

export type Mode = 'major' | 'minor';

export interface Key {
  /** Tonic as spelled by the user, normalized: "F#", "Bb". */
  tonic: string;
  /** Pitch class of the tonic, 0 = C. */
  tonicPc: number;
  mode: Mode;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
const FLAT_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];
/** Major-key tonics whose signatures use flats. */
const FLAT_MAJOR_TONICS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Pitch class of a spelled note name such as "C", "F#", "Bb", "E#". */
export function pitchClassOf(name: string): number | null {
  const m = /^([A-Ga-g])(#{1,2}|b{1,2})?$/.exec(name.trim());
  if (!m) return null;
  const accidental = m[2] ?? '';
  const shift = accidental.startsWith('#')
    ? accidental.length
    : -accidental.length;
  return mod12(LETTER_PC[m[1].toUpperCase()] + shift);
}

/**
 * Parses a user-entered key such as "A", "Am", "F# minor", "Bb major",
 * "C#min". Returns null when it isn't understood, so the key stays unknown
 * rather than guessed.
 */
export function parseKey(text: string | undefined): Key | null {
  if (!text) return null;
  const m = /^\s*([A-Ga-g])\s*(#|b|♯|♭)?\s*(m|min|minor|maj|major|M)?\s*$/.exec(
    text,
  );
  if (!m) return null;
  const accidental = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : (m[2] ?? '');
  const tonic = m[1].toUpperCase() + accidental;
  const quality = m[3] ?? '';
  const mode: Mode =
    quality === 'm' || quality.startsWith('min') ? 'minor' : 'major';
  const tonicPc = pitchClassOf(tonic);
  return tonicPc === null ? null : { tonic, tonicPc, mode };
}

export function formatKey(key: Key): string {
  return `${key.tonic} ${key.mode}`;
}

/** The relative major's tonic name, which decides the key signature. */
function signatureTonic(key: Key): string {
  if (key.mode === 'major') return key.tonic;
  // Relative major is a minor third up, spelled two letters up.
  const letter = LETTERS[(LETTERS.indexOf(key.tonic[0] as never) + 2) % 7];
  const pc = mod12(key.tonicPc + 3);
  return spellWithLetter(pc, letter);
}

function spellWithLetter(pc: number, letter: string): string {
  const diff = mod12(pc - LETTER_PC[letter]);
  const accidental =
    diff === 0 ? '' : diff <= 2 ? '#'.repeat(diff) : 'b'.repeat(12 - diff);
  return letter + accidental;
}

/** The seven notes of the key's signature, spelled with one letter each. */
function signatureSpellings(key: Key): Map<number, string> {
  const tonic = signatureTonic(key);
  const tonicPc = pitchClassOf(tonic) ?? 0;
  const start = LETTERS.indexOf(tonic[0] as never);
  const out = new Map<number, string>();
  MAJOR_STEPS.forEach((step, degree) => {
    const pc = mod12(tonicPc + step);
    out.set(pc, spellWithLetter(pc, LETTERS[(start + degree) % 7]));
  });
  return out;
}

/**
 * Spells a pitch class. In a key, notes of the key signature use its
 * spelling and other notes follow the signature's direction (flats in flat
 * keys, sharps otherwise). Without a key, sharps.
 */
export function spellPitchClass(pc: number, key?: Key | null): string {
  const p = mod12(pc);
  if (!key) return SHARP_NAMES[p];
  const inKey = signatureSpellings(key).get(p);
  if (inKey) return inKey;
  return FLAT_MAJOR_TONICS.has(signatureTonic(key))
    ? FLAT_NAMES[p]
    : SHARP_NAMES[p];
}

/** Spelled name with octave, e.g. 61 in Bb minor -> "Db4". */
export function spellMidi(midi: number, key?: Key | null): string {
  const name = spellPitchClass(midi, key);
  // Octave follows the letter: B#3 sounds as C4, Cb4 sounds as B3.
  const accidental = name.slice(1);
  const shift = accidental.startsWith('#')
    ? accidental.length
    : -accidental.length;
  return `${name}${Math.floor((midi - shift) / 12) - 1}`;
}
