import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Exercise, ExerciseProgress } from '@gsc/contracts';
import { TabEditorComponent } from '../tab-editor/tab-editor';
import { EditorEvent } from '../tab-editor/tab-editor-model';

const KIND_LABELS: Record<Exercise['kind'], string> = {
  isolate: 'Isolate',
  technique: 'Technique',
  slow: 'Slow practice',
  connect: 'Connect',
  apply: 'Over the chords',
};

/**
 * One practice exercise: its notes as tab, tempo ramp with play and
 * metronome controls, rule steps, AI tips (labelled), and completion.
 * Presentational: the caller owns audio and progress.
 */
@Component({
  selector: 'gsc-exercise-card',
  imports: [TabEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="space-y-3 rounded-lg border bg-white p-4"
      [class]="done() ? 'border-green-600' : 'border-stone-300'"
      [attr.aria-labelledby]="'exercise-' + exercise().id"
      data-testid="exercise"
    >
      <header class="flex flex-wrap items-baseline gap-2">
        <span class="text-sm tabular-nums text-stone-500">{{ number() }}.</span>
        <h3
          [id]="'exercise-' + exercise().id"
          class="font-semibold"
          data-testid="exercise-title"
        >
          {{ exercise().title }}
        </h3>
        <span
          class="rounded bg-stone-100 px-1.5 text-xs text-stone-700"
          data-testid="exercise-kind"
          >{{ kindLabel() }}</span
        >
        <span class="ml-auto text-xs text-stone-500"
          >about {{ exercise().minutes }} min</span
        >
      </header>
      <p class="text-sm">{{ exercise().objective }}</p>

      <gsc-tab-editor
        class="block"
        [events]="tabEvents()"
        [rhythmKnown]="false"
        [stringCount]="stringCount()"
        [stringLabels]="stringLabels()"
        [columnLabels]="noteNumbers()"
        [highlightIds]="highlightIds()"
        [readonly]="true"
      />

      @if (exercise().referenceNotes.length) {
        <ul class="space-y-1 text-sm" data-testid="exercise-references">
          @for (r of exercise().referenceNotes; track $index) {
            <li>
              Reference: string {{ r.stringIndex + 1 }}, fret {{ r.fret }} ·
              {{ r.label }}
              <button
                type="button"
                class="btn-ghost ml-1"
                (click)="playReference.emit($index)"
                data-testid="play-reference"
              >
                Play reference
              </button>
            </li>
          }
        </ul>
      }

      <div
        class="flex flex-wrap items-center gap-2 text-sm"
        role="group"
        [attr.aria-label]="'Tempo and playback for ' + exercise().title"
      >
        <button
          type="button"
          class="btn-secondary px-2 py-1"
          [disabled]="bpm() <= exercise().tempo.startBpm"
          (click)="tempoChange.emit(bpm() - exercise().tempo.stepBpm)"
          aria-label="Slower"
          data-testid="tempo-down"
        >
          −
        </button>
        <span
          class="w-20 text-center tabular-nums"
          aria-live="polite"
          data-testid="tempo"
          >{{ bpm() }} bpm</span
        >
        <button
          type="button"
          class="btn-secondary px-2 py-1"
          [disabled]="bpm() >= exercise().tempo.targetBpm"
          (click)="tempoChange.emit(bpm() + exercise().tempo.stepBpm)"
          aria-label="Faster"
          data-testid="tempo-up"
        >
          +
        </button>
        <span class="text-stone-600" data-testid="tempo-range"
          >{{ exercise().tempo.startBpm }} →
          {{ exercise().tempo.targetBpm }} bpm</span
        >
        @if (playing()) {
          <button
            type="button"
            class="btn-secondary"
            (click)="stopPlayback.emit()"
            data-testid="stop"
          >
            Stop
          </button>
        } @else {
          <button
            type="button"
            class="btn-secondary"
            (click)="playExercise.emit()"
            data-testid="play"
          >
            Play
          </button>
        }
        <button
          type="button"
          class="btn-secondary"
          [class.bg-stone-200]="metronomeOn()"
          [attr.aria-pressed]="metronomeOn()"
          (click)="toggleMetronome.emit()"
          data-testid="metronome"
        >
          Metronome
        </button>
        @if (metronomeOn()) {
          <span
            class="inline-flex gap-1"
            aria-hidden="true"
            data-testid="beat"
            [attr.data-beat]="beat()"
          >
            @for (b of [0, 1, 2, 3]; track b) {
              <span
                class="h-3 w-3 rounded-full"
                [class]="beat() % 4 === b ? 'bg-brand-600' : 'bg-stone-200'"
              ></span>
            }
          </span>
        }
        <button
          type="button"
          class="btn-ghost"
          (click)="downloadMidi.emit()"
          data-testid="download-midi"
        >
          Download .mid
        </button>
      </div>
      @if (!exercise().tempo.rhythmic) {
        <p class="text-xs text-stone-600">
          Playback is one note per click, not the real rhythm.
        </p>
      }

      <div class="text-sm">
        <p>
          <span class="font-medium">Do:</span>
          {{ exercise().repetitions }} repetitions.
          <span class="font-medium">Done when: </span>
          <span data-testid="exercise-success">{{
            exercise().successCriterion
          }}</span>
        </p>
        @if (exercise().instructions.length) {
          <ul class="mt-1 list-disc pl-5" data-testid="exercise-steps">
            @for (s of exercise().instructions; track $index) {
              <li>{{ s }}</li>
            }
          </ul>
        }
      </div>
      @if (exercise().coaching.length) {
        <div
          class="rounded bg-stone-50 p-2 text-sm"
          data-testid="exercise-coaching"
        >
          <p class="text-xs font-medium text-stone-600">Tips (written by AI)</p>
          <ul class="mt-1 list-disc pl-5">
            @for (t of exercise().coaching; track $index) {
              <li>{{ t }}</li>
            }
          </ul>
        </div>
      }

      @if (trackable()) {
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            [checked]="done()"
            (change)="complete.emit($any($event.target).checked)"
            data-testid="exercise-done"
          />
          Done
          @if (progress()?.bestBpm; as best) {
            <span class="text-stone-600" data-testid="exercise-best"
              >· best {{ best }} bpm</span
            >
          }
        </label>
      }
    </article>
  `,
})
export class ExerciseCardComponent {
  readonly exercise = input.required<Exercise>();
  readonly number = input(1);
  /** The phrase notes this exercise uses. */
  readonly tabEvents = input<EditorEvent[]>([]);
  readonly stringCount = input(6);
  readonly stringLabels = input<string[]>([]);
  /** Phrase note number of each tab column, so tab and text agree. */
  readonly noteNumbers = input<readonly number[]>([]);
  readonly bpm = input.required<number>();
  readonly playing = input(false);
  readonly metronomeOn = input(false);
  readonly beat = input(0);
  readonly progress = input<ExerciseProgress | null>(null);
  /** Show the "Done" checkbox; off for exercises that aren't saved. */
  readonly trackable = input(true);
  /** Badge text instead of the exercise kind (e.g. "Variation"). */
  readonly label = input<string | null>(null);
  /** Notes to highlight in the tab, e.g. what a variation changed. */
  readonly highlightIds = input<readonly string[]>([]);

  readonly playExercise = output<void>();
  readonly stopPlayback = output<void>();
  readonly toggleMetronome = output<void>();
  readonly tempoChange = output<number>();
  readonly playReference = output<number>();
  readonly downloadMidi = output<void>();
  readonly complete = output<boolean>();

  protected readonly done = computed(() => !!this.progress()?.completedAt);
  protected readonly kindLabel = computed(
    () => this.label() ?? KIND_LABELS[this.exercise().kind],
  );
}
