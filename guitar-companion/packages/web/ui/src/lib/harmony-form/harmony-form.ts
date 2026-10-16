import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
} from '@angular/core';
import { AlertComponent } from '../alert/alert';

/**
 * The player's harmonic assumptions: key and chord list (placement happens
 * per note in the notes table). Presentational: the caller parses, saves,
 * and reports errors.
 */
@Component({
  selector: 'gsc-harmony-form',
  imports: [AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="space-y-3 rounded-lg border border-stone-300 bg-white p-4"
      aria-labelledby="harmony-heading"
      data-testid="harmony"
    >
      <header>
        <h2 id="harmony-heading" class="text-lg font-semibold">Harmony</h2>
        <p class="text-sm text-stone-600">
          Your assumptions about the music around this phrase. Tab alone can't
          tell us the key or which chord is under each note.
        </p>
      </header>
      <div class="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label class="text-sm">
          <span class="block text-stone-700">Key</span>
          <input
            class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
            placeholder="e.g. A or F#m"
            autocomplete="off"
            [value]="key()"
            (input)="key.set($any($event.target).value)"
            data-testid="harmony-key"
          />
        </label>
        <label class="text-sm">
          <span class="block text-stone-700">Chords</span>
          <input
            class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
            placeholder="e.g. A7 D7 E7"
            autocomplete="off"
            [value]="chords()"
            (input)="chords.set($any($event.target).value)"
            data-testid="harmony-chords"
          />
        </label>
      </div>
      @if (unknownChords().length) {
        <p class="text-sm text-amber-800" data-testid="unknown-chords">
          Not understood, so not used for note roles:
          {{ unknownChords().join(', ') }}
        </p>
      }
      <p class="text-sm text-stone-600" data-testid="placement-help">
        {{ placementHelp() }}
      </p>
      @if (saveError(); as err) {
        <gsc-alert kind="error" heading="Could not save harmony">
          <p>{{ err.message }}</p>
          @if (err.conflict) {
            <button
              type="button"
              class="btn-secondary mt-2"
              (click)="reload.emit()"
              data-testid="harmony-reload"
            >
              Reload
            </button>
          }
        </gsc-alert>
      }
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="btn-primary"
          [disabled]="!dirty() || saving()"
          (click)="save.emit()"
          data-testid="harmony-save"
        >
          {{ saving() ? 'Saving…' : 'Save harmony' }}
        </button>
        @if (dirty()) {
          <span class="text-sm text-stone-600" data-testid="harmony-dirty"
            >Unsaved changes. Note roles already reflect them.</span
          >
        }
      </div>
    </section>
  `,
})
export class HarmonyFormComponent {
  /** Key as typed, e.g. "A" or "F#m". */
  readonly key = model('');
  /** Chord list as typed, e.g. "A7 D7". */
  readonly chords = model('');
  /** Symbols from `chords` that could not be parsed. */
  readonly unknownChords = input<readonly string[]>([]);
  /** One line on how chords are placed (or assumed). */
  readonly placementHelp = input('');
  readonly dirty = input(false);
  readonly saving = input(false);
  /** conflict: the phrase changed elsewhere, so offer a reload. */
  readonly saveError = input<{ message: string; conflict: boolean } | null>(
    null,
  );
  readonly save = output<void>();
  readonly reload = output<void>();
}
