/**
 * Pitch math for fretted strings. String index 0 is the highest-pitched
 * string, matching the DOMAIN_MODEL convention.
 */

/** Standard tuning, high E to low E, as MIDI note numbers. */
export const STANDARD_TUNING_MIDI: readonly number[] = [64, 59, 55, 50, 45, 40];

export const MAX_FRET = 24;

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
] as const;

export interface FretPosition {
  stringIndex: number;
  fret: number;
}

/** Sounding MIDI pitch of a string/fret, accounting for capo. Throws on invalid coordinates. */
export function pitchAt(
  tuningMidi: readonly number[],
  position: FretPosition,
  capo = 0,
): number {
  const { stringIndex, fret } = position;
  if (
    !Number.isInteger(stringIndex) ||
    stringIndex < 0 ||
    stringIndex >= tuningMidi.length
  ) {
    throw new RangeError(
      `Invalid string index ${stringIndex} for ${tuningMidi.length}-string tuning`,
    );
  }
  if (!Number.isInteger(capo) || capo < 0 || capo > MAX_FRET) {
    throw new RangeError(`Invalid capo ${capo}`);
  }
  if (!Number.isInteger(fret) || fret < 0 || fret + capo > MAX_FRET) {
    throw new RangeError(`Invalid fret ${fret} with capo ${capo}`);
  }
  return tuningMidi[stringIndex] + capo + fret;
}

/** Scientific pitch name using sharps, e.g. 60 -> "C4". */
export function midiToNoteName(midi: number): string {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError(`Invalid MIDI pitch ${midi}`);
  }
  return `${SHARP_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Signed semitone distance from one pitch to another. */
export function semitonesBetween(fromMidi: number, toMidi: number): number {
  return toMidi - fromMidi;
}
