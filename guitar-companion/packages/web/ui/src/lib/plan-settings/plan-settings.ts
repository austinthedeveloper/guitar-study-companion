import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { PlanSettings } from '@gsc/contracts';

const MINUTES = [5, 10, 15, 20, 30, 45, 60];

/** Difficulty, session length, and focus for building a practice plan. */
@Component({
  selector: 'gsc-plan-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="flex flex-wrap items-end gap-4 rounded-lg border border-stone-300 bg-white p-4 text-sm"
      aria-label="Plan settings"
      data-testid="plan-settings"
      (submit)="$event.preventDefault(); build.emit(value())"
    >
      <label>
        <span class="block text-stone-700">Difficulty</span>
        <select
          class="mt-1 rounded border border-stone-300 bg-white px-2 py-1"
          (change)="set('difficulty', $any($event.target).value)"
          data-testid="plan-difficulty"
        >
          @for (d of difficulties; track d.value) {
            <option
              [value]="d.value"
              [selected]="value().difficulty === d.value"
            >
              {{ d.label }}
            </option>
          }
        </select>
      </label>
      <label>
        <span class="block text-stone-700">Session</span>
        <select
          class="mt-1 rounded border border-stone-300 bg-white px-2 py-1"
          (change)="set('minutes', +$any($event.target).value)"
          data-testid="plan-minutes"
        >
          @for (m of minutes; track m) {
            <option [value]="m" [selected]="value().minutes === m">
              {{ m }} minutes
            </option>
          }
        </select>
      </label>
      <label>
        <span class="block text-stone-700">Focus</span>
        <select
          class="mt-1 rounded border border-stone-300 bg-white px-2 py-1"
          (change)="set('focus', $any($event.target).value)"
          data-testid="plan-focus"
        >
          @for (f of focuses; track f.value) {
            <option [value]="f.value" [selected]="value().focus === f.value">
              {{ f.label }}
            </option>
          }
        </select>
      </label>
      <button
        type="submit"
        class="btn-primary"
        [disabled]="busy()"
        data-testid="plan-build"
      >
        {{ busy() ? 'Building…' : hasPlan() ? 'Rebuild plan' : 'Build plan' }}
      </button>
    </form>
  `,
})
export class PlanSettingsComponent {
  /** Starting values, e.g. the current plan's settings. */
  readonly settings = input<PlanSettings>({
    difficulty: 'medium',
    minutes: 15,
    focus: 'balanced',
  });
  readonly busy = input(false);
  readonly hasPlan = input(false);
  readonly build = output<PlanSettings>();

  protected readonly minutes = MINUTES;
  protected readonly difficulties = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ] as const;
  protected readonly focuses = [
    { value: 'balanced', label: 'Balanced' },
    { value: 'technique', label: 'Technique' },
    { value: 'accuracy', label: 'Accuracy' },
    { value: 'harmony', label: 'Playing over chords' },
  ] as const;
  protected readonly value = signal<PlanSettings>(this.settings());

  constructor() {
    effect(() => this.value.set(this.settings()));
  }

  protected set<K extends keyof PlanSettings>(
    key: K,
    v: PlanSettings[K],
  ): void {
    this.value.update((s) => ({ ...s, [key]: v }));
  }
}
