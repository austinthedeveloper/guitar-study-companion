import { Technique, TICKS_PER_QUARTER } from '@gsc/contracts';

/** Editor rows are tab events with optional recognition confidence. */
export interface EditorEvent {
  id: string;
  order: number;
  stringIndex: number;
  fret: number | null;
  durationTicks: number | null;
  techniques: Technique[];
  bendSemitones?: number;
  confidence?: number;
}

export const LOW_CONFIDENCE = 0.6;

export const TECHNIQUE_OPTIONS: { value: Technique; label: string }[] = [
  { value: 'bend', label: 'Bend' },
  { value: 'pre-bend', label: 'Pre-bend' },
  { value: 'release', label: 'Release' },
  { value: 'slide', label: 'Slide' },
  { value: 'hammer-on', label: 'Hammer-on' },
  { value: 'pull-off', label: 'Pull-off' },
  { value: 'vibrato', label: 'Vibrato' },
  { value: 'palm-mute', label: 'Palm mute' },
  { value: 'dead-note', label: 'Dead note (x)' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'let-ring', label: 'Let ring' },
  { value: 'tap', label: 'Tap' },
  { value: 'harmonic', label: 'Harmonic' },
];

export const BEND_OPTIONS = [
  { value: 0.5, label: '¼' },
  { value: 1, label: '½' },
  { value: 2, label: 'Full' },
  { value: 3, label: '1½' },
  { value: 4, label: '2' },
];

const Q = TICKS_PER_QUARTER;
export const DURATION_OPTIONS = [
  { value: Q * 4, label: 'Whole' },
  { value: Q * 2, label: 'Half' },
  { value: (Q * 3) / 2, label: 'Dotted quarter' },
  { value: Q, label: 'Quarter' },
  { value: (Q * 3) / 4, label: 'Dotted eighth' },
  { value: Q / 2, label: 'Eighth' },
  { value: Q / 3, label: 'Eighth triplet' },
  { value: Q / 4, label: 'Sixteenth' },
  { value: Q / 6, label: 'Sixteenth triplet' },
  { value: Q / 8, label: '32nd' },
];

/** Parses a cell entry: '' clears, 'x' is a dead note, 0-24 is a fret. Returns 'invalid' otherwise. */
export function parseCell(
  text: string,
):
  | { kind: 'clear' }
  | { kind: 'dead' }
  | { kind: 'fret'; fret: number }
  | { kind: 'invalid' } {
  const t = text.trim().toLowerCase();
  if (t === '') return { kind: 'clear' };
  if (t === 'x') return { kind: 'dead' };
  if (/^\d{1,2}$/.test(t) && Number(t) <= 24)
    return { kind: 'fret', fret: Number(t) };
  return { kind: 'invalid' };
}

export function cellText(e: EditorEvent | undefined): string {
  if (!e) return '';
  return e.fret === null ? 'x' : String(e.fret);
}
