import { ChangeDetectionStrategy, Component, model } from '@angular/core';

export type OctaveChoice = 'nearest' | 'up' | 'down';

const POSITIONS = [
  { value: null, label: 'Keep the original shape' },
  { value: 0, label: 'Open position (frets 0–4)' },
  { value: 3, label: '3rd position (frets 3–7)' },
  { value: 5, label: '5th position (frets 5–9)' },
  { value: 7, label: '7th position (frets 7–11)' },
  { value: 9, label: '9th position (frets 9–13)' },
  { value: 12, label: '12th position (frets 12–16)' },
] as const;
const MAX_FRETS = [12, 15, 17, 19, 22];

/** Target key and fingering preferences for transposing a phrase. */
@Component({
  selector: 'gsc-transpose-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="grid gap-3 rounded-lg border border-stone-300 bg-white p-4 text-sm sm:grid-cols-5"
      aria-label="Transpose settings"
      data-testid="transpose-form"
      (submit)="$event.preventDefault()"
    >
      <label>
        <span class="block text-stone-700">From key</span>
        <input
          class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
          autocomplete="off"
          placeholder="e.g. A"
          [value]="fromKey()"
          (input)="fromKey.set($any($event.target).value)"
          data-testid="transpose-from"
        />
      </label>
      <label>
        <span class="block text-stone-700">To key</span>
        <input
          class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
          autocomplete="off"
          placeholder="e.g. C"
          [value]="toKey()"
          (input)="toKey.set($any($event.target).value)"
          data-testid="transpose-to"
        />
      </label>
      <label>
        <span class="block text-stone-700">Octave</span>
        <select
          class="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1"
          (change)="octave.set($any($event.target).value)"
          data-testid="transpose-octave"
        >
          @for (o of octaves; track o.value) {
            <option [value]="o.value" [selected]="octave() === o.value">
              {{ o.label }}
            </option>
          }
        </select>
      </label>
      <label>
        <span class="block text-stone-700">Position</span>
        <select
          class="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1"
          (change)="setPosition($any($event.target).value)"
          data-testid="transpose-position"
        >
          @for (p of positions; track p.label) {
            <option [value]="p.value ?? ''" [selected]="position() === p.value">
              {{ p.label }}
            </option>
          }
        </select>
      </label>
      <label>
        <span class="block text-stone-700">Highest fret</span>
        <select
          class="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1"
          (change)="maxFret.set(+$any($event.target).value)"
          data-testid="transpose-max-fret"
        >
          @for (f of maxFrets; track f) {
            <option [value]="f" [selected]="maxFret() === f">{{ f }}</option>
          }
        </select>
      </label>
    </form>
  `,
})
export class TransposeFormComponent {
  readonly fromKey = model('');
  readonly toKey = model('');
  readonly octave = model<OctaveChoice>('nearest');
  /** Lowest fret of the preferred hand position; null keeps the shape. */
  readonly position = model<number | null>(null);
  readonly maxFret = model(22);

  protected readonly positions = POSITIONS;
  protected readonly maxFrets = MAX_FRETS;
  protected readonly octaves = [
    { value: 'nearest', label: 'Nearest' },
    { value: 'up', label: 'Up' },
    { value: 'down', label: 'Down' },
  ] as const;

  protected setPosition(value: string): void {
    this.position.set(value === '' ? null : Number(value));
  }
}
