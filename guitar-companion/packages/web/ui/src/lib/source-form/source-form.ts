import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MusicalContext, SourceReference } from '@gsc/contracts';
import { findTuningPreset, TUNING_PRESETS } from '@gsc/music-domain';

export interface SourceFormValue {
  source: SourceReference;
  context: MusicalContext;
}

/** Source metadata and musical context for an import. Emits on every valid change. */
@Component({
  selector: 'gsc-source-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      [formGroup]="form"
      class="grid gap-4 sm:grid-cols-2"
      data-testid="source-form"
      (ngSubmit)="$event.preventDefault()"
    >
      <label class="field sm:col-span-2">
        <span>Book title <span aria-hidden="true">*</span></span>
        <input
          formControlName="bookTitle"
          required
          autocomplete="off"
          data-testid="book-title"
          [attr.aria-invalid]="showError('bookTitle')"
          aria-describedby="book-title-error"
        />
        @if (showError('bookTitle')) {
          <span id="book-title-error" class="text-sm text-red-700"
            >Enter the book title so you can find this later.</span
          >
        }
      </label>
      <label class="field">
        <span>Song or section</span>
        <input
          formControlName="songTitle"
          autocomplete="off"
          data-testid="song-title"
        />
      </label>
      <label class="field">
        <span>Page</span>
        <input formControlName="page" autocomplete="off" data-testid="page" />
      </label>
      <label class="field">
        <span>Tuning</span>
        <select formControlName="tuning" data-testid="tuning">
          @for (t of tunings; track t.id) {
            <option [value]="t.id">{{ t.label }}</option>
          }
        </select>
      </label>
      <label class="field">
        <span>Capo</span>
        <input
          type="number"
          min="0"
          max="12"
          formControlName="capo"
          data-testid="capo"
        />
      </label>
      <label class="field">
        <span>Key (if known)</span>
        <input
          formControlName="key"
          placeholder="e.g. G major"
          autocomplete="off"
          data-testid="key"
        />
      </label>
      <label class="field">
        <span>Chords (if known)</span>
        <input
          formControlName="chords"
          placeholder="e.g. G D/F# Em C"
          autocomplete="off"
          data-testid="chords"
        />
      </label>
    </form>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    .field input,
    .field select {
      border: 1px solid var(--color-stone-300);
      border-radius: 0.25rem;
      padding: 0.375rem 0.5rem;
      background: white;
    }
  `,
})
export class SourceFormComponent {
  /**
   * Seeds the form until it has been seeded or edited. Later values are ignored,
   * so a parent can bind `valueChange` back here without the trimmed value
   * overwriting what the user is typing (e.g. eating a trailing space).
   */
  readonly initial = input<SourceFormValue | null>(null);
  /** Forces validation messages to show (e.g. after a submit attempt). */
  readonly showErrors = input(false);
  readonly valueChange = output<SourceFormValue | null>();

  protected readonly tunings = TUNING_PRESETS;
  protected readonly form = new FormGroup({
    bookTitle: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    songTitle: new FormControl('', { nonNullable: true }),
    page: new FormControl('', { nonNullable: true }),
    tuning: new FormControl('standard', { nonNullable: true }),
    capo: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(12)],
    }),
    key: new FormControl('', { nonNullable: true }),
    chords: new FormControl('', { nonNullable: true }),
  });
  private readonly forceErrors = computed(() => this.showErrors());
  private synced = false;

  constructor() {
    effect(() => {
      const v = this.initial();
      if (!v || this.synced) return;
      this.synced = true;
      this.form.patchValue(
        {
          bookTitle: v.source.bookTitle,
          songTitle: v.source.songTitle ?? '',
          page: v.source.page ?? '',
          tuning: findTuningPreset(v.context.tuningMidi)?.id ?? 'standard',
          capo: v.context.capo,
          key: v.context.key ?? '',
          chords: v.context.chords ?? '',
        },
        { emitEvent: false },
      );
      this.valueChange.emit(this.current());
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.synced = true;
      this.valueChange.emit(this.current());
    });
  }

  protected showError(name: 'bookTitle'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.forceErrors());
  }

  private current(): SourceFormValue | null {
    if (this.form.invalid) return null;
    const v = this.form.getRawValue();
    const opt = (s: string) => (s.trim() ? s.trim() : undefined);
    const preset =
      TUNING_PRESETS.find((t) => t.id === v.tuning) ?? TUNING_PRESETS[0];
    return {
      source: {
        bookTitle: v.bookTitle.trim(),
        songTitle: opt(v.songTitle),
        page: opt(v.page),
      },
      context: {
        tuningMidi: [...preset.midi],
        capo: Number(v.capo) || 0,
        key: opt(v.key),
        chords: opt(v.chords),
      },
    };
  }
}
