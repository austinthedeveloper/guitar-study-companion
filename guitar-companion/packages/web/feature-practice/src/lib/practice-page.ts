import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  InjectionToken,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  Exercise,
  ExerciseProgress,
  PlanSettings,
  PracticePlan,
} from '@gsc/contracts';
import {
  encodeMidiFile,
  NoteEvent,
  PlayableColumn,
  PracticeAudio,
  toNoteEvents,
} from '@gsc/web/audio';
import { PhrasesApi, PracticeApi, toClientError } from '@gsc/web/data-access';
import { analyzeNotes, midiToNoteName, parseKey } from '@gsc/music-domain';
import {
  AlertComponent,
  ExerciseCardComponent,
  PlanSettingsComponent,
} from '@gsc/web/ui';
import { catchError, firstValueFrom, of, throwError } from 'rxjs';

/** Creates the audio engine on first use (after a user gesture). */
export const PRACTICE_AUDIO = new InjectionToken<() => PracticeAudio>(
  'PRACTICE_AUDIO',
  { providedIn: 'root', factory: () => () => new PracticeAudio() },
);

@Component({
  selector: 'gsc-practice-page',
  imports: [
    AlertComponent,
    ExerciseCardComponent,
    PlanSettingsComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (phrase.isLoading()) {
      <p class="text-stone-600" role="status">Loading…</p>
    } @else if (phraseError(); as err) {
      @if (err.code === 'not_found') {
        <section class="py-12 text-center" data-testid="practice-not-found">
          <h1 class="text-2xl font-semibold">Phrase not found</h1>
          <a
            routerLink="/phrases"
            class="mt-4 inline-block text-brand-700 underline"
            >Back to my phrases</a
          >
        </section>
      } @else {
        <gsc-alert kind="error" heading="Could not load this phrase">
          <p>{{ err.message }}</p>
          <button
            type="button"
            class="btn-secondary mt-2"
            (click)="phrase.reload()"
          >
            Try again
          </button>
        </gsc-alert>
      }
    } @else if (phrase.value(); as p) {
      <article class="space-y-5" data-testid="practice">
        <header>
          <a
            [routerLink]="['/phrases', p.id]"
            class="text-sm text-brand-700 underline"
            >← {{ p.title }}</a
          >
          <h1
            class="mt-1 text-2xl font-semibold"
            data-testid="practice-heading"
          >
            Practice
          </h1>
          <p class="text-sm text-stone-600">
            Exercises are built from your verified notes. Progress is what you
            report; nothing listens to your playing.
          </p>
        </header>

        <gsc-plan-settings
          [settings]="plan()?.settings ?? defaults"
          [busy]="building() || planLoading()"
          [hasPlan]="!!plan()"
          (build)="build($event)"
        />
        @if (buildError(); as err) {
          <gsc-alert kind="error" heading="Could not build a plan">
            <p>{{ err }}</p>
          </gsc-alert>
        }

        @if (planLoading()) {
          <p class="text-stone-600" role="status">Loading plan…</p>
        } @else if (plan(); as pl) {
          @if (pl.phraseRevision !== p.revision) {
            <gsc-alert kind="warning" data-testid="plan-stale"
              >This plan was built for an earlier version of the phrase. Rebuild
              it to match your current key and chords.</gsc-alert
            >
          }
          @if (!pl.coachedBy) {
            <p class="text-sm text-stone-600" data-testid="plan-uncoached">
              AI tips weren't available for this plan; the steps below come from
              the rules.
            </p>
          }
          @if (pl.rejected.length) {
            <gsc-alert kind="info" heading="Exercises left out">
              <ul class="list-disc pl-5" data-testid="plan-rejected">
                @for (r of pl.rejected; track $index) {
                  <li>{{ r.title }}: {{ r.reasons.join(' ') }}</li>
                }
              </ul>
            </gsc-alert>
          }
          <p class="text-sm font-medium" data-testid="plan-progress">
            {{ doneCount() }} of {{ pl.exercises.length }} done
            <span class="font-normal text-stone-600">
              · {{ saveStatus() }}</span
            >
          </p>
          <div class="space-y-4">
            @for (x of pl.exercises; track x.id; let i = $index) {
              <gsc-exercise-card
                [exercise]="x"
                [number]="i + 1"
                [tabEvents]="eventsFor(x)"
                [noteNumbers]="noteNumbersFor(x)"
                [stringCount]="p.context.tuningMidi.length"
                [stringLabels]="stringLabels()"
                [bpm]="bpmOf(x)"
                [playing]="playingId() === x.id"
                [metronomeOn]="metronomeId() === x.id"
                [beat]="beat()"
                [progress]="progressOf(x)"
                (playExercise)="play(x)"
                (stopPlayback)="stop()"
                (toggleMetronome)="toggleMetronome(x)"
                (tempoChange)="setTempo(x, $event)"
                (playReference)="playReference(x, $event)"
                (downloadMidi)="downloadMidi(x)"
                (complete)="complete(x, $event)"
              />
            }
          </div>
          <label class="block text-sm">
            <span class="block font-medium">Session notes</span>
            <textarea
              class="mt-1 w-full rounded border border-stone-300 p-2"
              rows="3"
              placeholder="What felt hard? What to try next time?"
              [value]="notes()"
              (input)="notes.set($any($event.target).value)"
              (blur)="save()"
              data-testid="session-notes"
            ></textarea>
          </label>
        } @else {
          <p class="text-stone-600" data-testid="plan-empty">
            No plan yet. Choose settings and build one.
          </p>
        }
      </article>
    }
  `,
})
export class PracticePage {
  /** Phrase id, bound from the route. */
  readonly id = input.required<string>();
  private readonly phrases = inject(PhrasesApi);
  private readonly practice = inject(PracticeApi);
  private readonly createAudio = inject(PRACTICE_AUDIO);
  private audio: PracticeAudio | null = null;

  protected readonly defaults: PlanSettings = {
    difficulty: 'medium',
    minutes: 15,
    focus: 'balanced',
  };

  protected readonly phrase = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.phrases.get(params),
  });
  protected readonly phraseError = computed(() =>
    this.phrase.error() ? toClientError(this.phrase.error()) : null,
  );
  private readonly loaded = computed(() =>
    this.phrase.hasValue() ? this.phrase.value() : undefined,
  );

  /** Latest plan; null when none has been built yet. */
  private readonly latest = rxResource({
    params: () => this.id(),
    stream: ({ params }) =>
      this.practice
        .latestPlan(params)
        .pipe(
          catchError((err) =>
            toClientError(err).code === 'not_found'
              ? of(null)
              : throwError(() => err),
          ),
        ),
  });
  protected readonly plan = computed<PracticePlan | null>(() =>
    this.latest.hasValue() ? this.latest.value() : null,
  );
  protected readonly planLoading = computed(() => this.latest.isLoading());

  private readonly session = rxResource({
    params: () => this.plan()?.id,
    stream: ({ params }) => this.practice.session(params),
  });
  protected readonly progress = signal<Record<string, ExerciseProgress>>({});
  protected readonly notes = signal('');
  protected readonly saveStatus = signal('Progress saves as you go');
  protected readonly doneCount = computed(
    () =>
      (this.plan()?.exercises ?? []).filter(
        (x) => this.progress()[x.id]?.completedAt,
      ).length,
  );

  protected readonly building = signal(false);
  protected readonly buildError = signal<string | null>(null);
  private readonly bpm = signal<Record<string, number>>({});
  protected readonly playingId = signal<string | null>(null);
  protected readonly metronomeId = signal<string | null>(null);
  protected readonly beat = signal(0);

  private readonly analysis = computed(() => {
    const p = this.loaded();
    return analyzeNotes({
      events: p?.events ?? [],
      tuningMidi: p?.context.tuningMidi ?? [],
      capo: p?.context.capo ?? 0,
      key: parseKey(p?.context.key),
    });
  });
  protected readonly stringLabels = computed(() =>
    (this.loaded()?.context.tuningMidi ?? []).map((m) =>
      midiToNoteName(m).replace(/-?\d+$/, ''),
    ),
  );

  constructor() {
    effect(() => {
      const s = this.session.hasValue() ? this.session.value() : undefined;
      this.progress.set(s?.progress ?? {});
      this.notes.set(s?.notes ?? '');
    });
    inject(DestroyRef).onDestroy(() => this.audio?.dispose());
  }

  protected eventsFor(x: Exercise) {
    const ids = new Set(x.eventIds);
    return (this.loaded()?.events ?? []).filter((e) => ids.has(e.id));
  }

  /** Phrase note number of each column the exercise uses, in order. */
  protected noteNumbersFor(x: Exercise): number[] {
    const ids = new Set(x.eventIds);
    return this.analysis().columns.flatMap((c, i) =>
      c.notes.some((n) => ids.has(n.eventId)) ? [i + 1] : [],
    );
  }

  protected progressOf(x: Exercise): ExerciseProgress | null {
    return this.progress()[x.id] ?? null;
  }

  protected bpmOf(x: Exercise): number {
    return this.bpm()[x.id] ?? x.tempo.startBpm;
  }

  private engine(): PracticeAudio {
    this.audio ??= this.createAudio();
    return this.audio;
  }

  /** The exercise's notes as timed sound events at its current tempo. */
  private noteEvents(x: Exercise): NoteEvent[] {
    const ids = new Set(x.eventIds);
    const byId = new Map((this.loaded()?.events ?? []).map((e) => [e.id, e]));
    const columns: PlayableColumn[] = this.analysis()
      .columns.map((c) => {
        const notes = c.notes.filter((n) => ids.has(n.eventId));
        return {
          notes: notes.map((n) => ({
            midi: n.midi,
            dead: n.dead,
            ...(n.bendToMidi !== undefined && n.midi !== null
              ? { bendSemitones: n.bendToMidi - n.midi }
              : {}),
          })),
          durationTicks: byId.get(notes[0]?.eventId ?? '')?.durationTicks,
        };
      })
      .filter((c) => c.notes.length);
    return toNoteEvents(columns, {
      bpm: this.bpmOf(x),
      rhythmic: x.tempo.rhythmic,
    });
  }

  protected async build(settings: PlanSettings): Promise<void> {
    const p = this.loaded();
    if (!p) return;
    this.stop();
    this.building.set(true);
    this.buildError.set(null);
    try {
      const plan = await firstValueFrom(
        this.practice.createPlan(p.id, p.revision, settings),
      );
      this.latest.value.set(plan);
      this.bpm.set({});
    } catch (err) {
      this.buildError.set(toClientError(err).message);
    } finally {
      this.building.set(false);
    }
  }

  protected play(x: Exercise): void {
    this.playingId.set(x.id);
    this.engine().play(this.noteEvents(x), () => this.playingId.set(null));
  }

  protected stop(): void {
    this.audio?.stopNotes();
    this.audio?.stopMetronome();
    this.playingId.set(null);
    this.metronomeId.set(null);
  }

  protected playReference(x: Exercise, index: number): void {
    const p = this.loaded();
    const r = x.referenceNotes[index];
    if (!p || !r) return;
    const midi = p.context.tuningMidi[r.stringIndex] + p.context.capo + r.fret;
    this.engine().play([{ midi, start: 0, duration: 1.5, bendCents: 0 }]);
  }

  protected toggleMetronome(x: Exercise): void {
    if (this.metronomeId() === x.id) {
      this.engine().stopMetronome();
      this.metronomeId.set(null);
      return;
    }
    this.startMetronome(x);
  }

  private startMetronome(x: Exercise): void {
    this.metronomeId.set(x.id);
    this.beat.set(0);
    this.engine().startMetronome(this.bpmOf(x), (beat) => this.beat.set(beat));
  }

  protected setTempo(x: Exercise, bpm: number): void {
    const clamped = Math.min(
      x.tempo.targetBpm,
      Math.max(x.tempo.startBpm, bpm),
    );
    this.bpm.update((m) => ({ ...m, [x.id]: clamped }));
    if (this.metronomeId() === x.id) this.startMetronome(x);
  }

  protected downloadMidi(x: Exercise): void {
    const bytes = encodeMidiFile(this.noteEvents(x), this.bpmOf(x));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(this.loaded()?.title ?? 'phrase')}-${x.id}-${this.bpmOf(x)}bpm.mid`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected complete(x: Exercise, done: boolean): void {
    const prev = this.progress()[x.id];
    this.progress.update((m) => ({
      ...m,
      [x.id]: {
        completedAt: done ? new Date().toISOString() : null,
        bestBpm: Math.max(prev?.bestBpm ?? 0, this.bpmOf(x)) || null,
      },
    }));
    void this.save();
  }

  protected async save(): Promise<void> {
    const plan = this.plan();
    if (!plan) return;
    this.saveStatus.set('Saving…');
    try {
      await firstValueFrom(
        this.practice.saveSession(plan.id, {
          progress: this.progress(),
          notes: this.notes(),
        }),
      );
      this.saveStatus.set('Saved');
    } catch (err) {
      this.saveStatus.set(`Not saved: ${toClientError(err).message}`);
    }
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'phrase';
