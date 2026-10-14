export interface TuningPreset {
  id: string;
  label: string;
  /** High string first (index 0). */
  midi: readonly number[];
}

export const TUNING_PRESETS: readonly TuningPreset[] = [
  {
    id: 'standard',
    label: 'Standard (E A D G B E)',
    midi: [64, 59, 55, 50, 45, 40],
  },
  {
    id: 'half-down',
    label: 'Half step down (Eb)',
    midi: [63, 58, 54, 49, 44, 39],
  },
  {
    id: 'drop-d',
    label: 'Drop D (D A D G B E)',
    midi: [64, 59, 55, 50, 45, 38],
  },
  { id: 'dadgad', label: 'DADGAD', midi: [62, 57, 55, 50, 45, 38] },
  {
    id: 'open-g',
    label: 'Open G (D G D G B D)',
    midi: [62, 59, 55, 50, 43, 38],
  },
  {
    id: 'open-d',
    label: 'Open D (D A D F# A D)',
    midi: [62, 57, 54, 50, 45, 38],
  },
  {
    id: 'open-e',
    label: 'Open E (E B E G# B E)',
    midi: [64, 59, 56, 52, 47, 40],
  },
];

export function findTuningPreset(
  midi: readonly number[],
): TuningPreset | undefined {
  return TUNING_PRESETS.find(
    (p) =>
      p.midi.length === midi.length && p.midi.every((m, i) => m === midi[i]),
  );
}
