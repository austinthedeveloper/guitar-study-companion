import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChordChange, Phrase } from '@gsc/contracts';
import {
  analyzeNotes,
  candidateScales,
  findTuningPreset,
  formatKey,
  harmonize,
  midiToNoteName,
  parseKey,
  parseProgression,
} from '@gsc/music-domain';
import {
  ClientError,
  Flash,
  PhrasesApi,
  toClientError,
} from '@gsc/web/data-access';
import {
  AlertComponent,
  ExplanationComponent,
  HarmonyFormComponent,
  NoteFactsComponent,
  ScaleCandidatesComponent,
  TabEditorComponent,
} from '@gsc/web/ui';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'gsc-phrase-detail-page',
  imports: [
    AlertComponent,
    ExplanationComponent,
    HarmonyFormComponent,
    NoteFactsComponent,
    ScaleCandidatesComponent,
    TabEditorComponent,
    RouterLink,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (phrase.isLoading()) {
      <p class="text-stone-600" role="status">Loading…</p>
    } @else if (error(); as err) {
      @if (err.code === 'not_found') {
        <section class="py-12 text-center" data-testid="phrase-not-found">
          <h1 class="text-2xl font-semibold">Phrase not found</h1>
          <p class="mt-2 text-stone-600">
            It may have been deleted, or the link is wrong.
          </p>
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
      <article class="space-y-5" data-testid="phrase-detail">
        @if (justSaved) {
          <gsc-alert kind="success" data-testid="saved-banner"
            >Saved. This verified phrase is now the source of truth for analysis
            and practice.</gsc-alert
          >
        }
        <header>
          <h1
            class="text-2xl font-semibold text-stone-900"
            data-testid="phrase-heading"
          >
            {{ p.title }}
          </h1>
          <p class="text-stone-600" data-testid="phrase-source">
            {{ p.source.bookTitle }}
            @if (p.source.songTitle) {
              · {{ p.source.songTitle }}
            }
            @if (p.source.page) {
              · p. {{ p.source.page }}
            }
          </p>
        </header>
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt class="text-stone-600">Tuning</dt>
          <dd data-testid="phrase-tuning">{{ tuningLabel() }}</dd>
          <dt class="text-stone-600">Capo</dt>
          <dd>{{ p.context.capo || 'None' }}</dd>
          <dt class="text-stone-600">Rhythm</dt>
          <dd data-testid="phrase-rhythm">
            {{ p.rhythmKnown ? 'Known' : 'Unknown (not transcribed)' }}
          </dd>
          <dt class="text-stone-600">Origin</dt>
          <dd data-testid="phrase-origin">
            @if (p.derivedFrom; as d) {
              {{ d.change }} from
              <a
                [routerLink]="['/phrases', d.phraseId]"
                class="text-brand-700 underline"
                data-testid="phrase-derived-from"
                >the original phrase</a
              >
            } @else {
              {{
                p.draftProvider
                  ? 'AI draft (' + p.draftProvider + '), corrected by you'
                  : 'Entered manually'
              }}
            }
          </dd>
          <dt class="text-stone-600">Saved</dt>
          <dd>{{ p.createdAt | date: 'medium' }}</dd>
        </dl>
        <gsc-tab-editor
          class="block"
          [events]="events()"
          [rhythmKnown]="p.rhythmKnown"
          [stringCount]="p.context.tuningMidi.length"
          [stringLabels]="stringLabels()"
          [readonly]="true"
          [roles]="roles()"
          [columnChords]="columnChords()"
          [highlightIds]="highlightIds()"
        />
        <gsc-harmony-form
          [(key)]="keyText"
          [(chords)]="chordsText"
          [unknownChords]="unknownChords()"
          [placementHelp]="placementHelp()"
          [dirty]="dirty()"
          [saving]="saving()"
          [saveError]="
            saveError()
              ? {
                  message: saveError()!.message,
                  conflict: saveError()!.code === 'conflict',
                }
              : null
          "
          (save)="saveHarmony(p)"
          (reload)="phrase.reload()"
        />
        <gsc-note-facts
          [analysis]="noteAnalysis()"
          [keyLabel]="key() ? formatKey(key()!) : null"
          [unparsedKey]="key() ? null : keyText().trim() || null"
          [roles]="roles()"
          [columnChords]="columnChords()"
          [chordOptions]="chordOptions()"
          [chordStarts]="chordStarts()"
          (chordChange)="placeChord($event.order, $event.chord)"
        />
        <gsc-scale-candidates [analysis]="scales()" />
        <gsc-explanation
          [explanation]="p.explanation ?? null"
          [stale]="
            !!p.explanation && p.explanation.phraseRevision !== p.revision
          "
          [busy]="explaining()"
          [error]="explainError()"
          [blockedReason]="
            dirty()
              ? 'Save your harmony changes first; the explanation uses the saved phrase.'
              : null
          "
          [stepOf]="stepOf()"
          [shownIds]="highlightIds()"
          (explain)="explain(p)"
          (showNotes)="highlightIds.set($event)"
        />
        <div class="flex flex-wrap gap-4">
          <a
            [routerLink]="['/phrases', p.id, 'practice']"
            class="btn-primary"
            data-testid="practice-link"
            >Practice this phrase</a
          >
          <a
            [routerLink]="['/phrases', p.id, 'transpose']"
            class="btn-secondary"
            data-testid="transpose-link"
            >Transpose and vary</a
          >
          <a routerLink="/phrases" class="self-center text-brand-700 underline"
            >All phrases</a
          >
        </div>
      </article>
    }
  `,
})
export class PhraseDetailPage {
  /** Bound from the route parameter. */
  readonly id = input.required<string>();
  private readonly api = inject(PhrasesApi);
  protected readonly justSaved = inject(Flash).consume('phrase-saved');

  protected readonly phrase = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.get(params),
  });
  /** The loaded phrase, or undefined while loading or after an error. */
  private readonly loaded = computed(() =>
    this.phrase.hasValue() ? this.phrase.value() : undefined,
  );
  protected readonly error = computed(() =>
    this.phrase.error() ? toClientError(this.phrase.error()) : null,
  );
  protected readonly events = computed(() => this.loaded()?.events ?? []);
  protected readonly formatKey = formatKey;

  // Harmony being edited; reset whenever a phrase (or new revision) loads.
  protected readonly keyText = signal('');
  protected readonly chordsText = signal('');
  protected readonly changes = signal<ChordChange[]>([]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<ClientError | null>(null);

  protected readonly key = computed(() => parseKey(this.keyText()));
  private readonly progression = computed(() =>
    parseProgression(this.chordsText()),
  );
  protected readonly unknownChords = computed(() =>
    this.progression()
      .filter((p) => !p.chord)
      .map((p) => p.text),
  );
  protected readonly chordOptions = computed(() => [
    ...new Set([
      ...this.progression()
        .filter((p) => p.chord)
        .map((p) => p.text),
      // Keep placed chords selectable even if removed from the list.
      ...this.changes().map((c) => c.chord),
    ]),
  ]);
  private readonly harmony = computed(() =>
    harmonize({
      analysis: this.noteAnalysis(),
      chords: this.chordsText(),
      chordChanges: this.changes(),
    }),
  );
  protected readonly chordStarts = computed(() =>
    Object.fromEntries(this.changes().map((c) => [c.fromOrder, c.chord])),
  );
  protected readonly placementHelp = computed(() => {
    if (!this.chordOptions().length)
      return 'Add chords to see what role each note plays.';
    if (this.changes().length)
      return 'Each chord lasts until the next one you place.';
    const assumed = this.harmony().assumed && this.harmony().changes[0];
    return assumed
      ? `Assumed: the whole phrase is over ${assumed.chord}. Place chords below to change this.`
      : 'Use the Chord column below to show where each chord starts.';
  });
  protected readonly columnChords = computed(() => this.harmony().columnChords);
  protected readonly roles = computed(() => this.harmony().roles);
  protected readonly scales = computed(() =>
    candidateScales({
      analysis: this.noteAnalysis(),
      key: this.key(),
      chords: this.harmony().chords,
    }),
  );
  /** Notes highlighted in the tab, from an explanation point. */
  protected readonly highlightIds = signal<string[]>([]);
  protected readonly explaining = signal(false);
  protected readonly explainError = signal<string | null>(null);
  protected readonly stepOf = computed(() =>
    Object.fromEntries(
      this.noteAnalysis().columns.flatMap((col, i) =>
        col.notes.map((n) => [n.eventId, i + 1]),
      ),
    ),
  );

  protected async explain(p: Phrase): Promise<void> {
    this.explaining.set(true);
    this.explainError.set(null);
    try {
      this.phrase.value.set(
        await firstValueFrom(this.api.explain(p.id, p.revision)),
      );
    } catch (err) {
      this.explainError.set(toClientError(err).message);
    } finally {
      this.explaining.set(false);
    }
  }

  protected readonly dirty = computed(() => {
    const ctx = this.loaded()?.context;
    if (!ctx) return false;
    return (
      this.keyText().trim() !== (ctx.key ?? '') ||
      this.chordsText().trim() !== (ctx.chords ?? '') ||
      JSON.stringify(sortChanges(this.changes())) !==
        JSON.stringify(sortChanges(ctx.chordChanges ?? []))
    );
  });

  constructor() {
    effect(() => {
      const ctx = this.loaded()?.context;
      this.keyText.set(ctx?.key ?? '');
      this.chordsText.set(ctx?.chords ?? '');
      this.changes.set(ctx?.chordChanges ?? []);
      this.saveError.set(null);
    });
  }

  protected placeChord(order: number, chord: string | null): void {
    const rest = this.changes().filter((c) => c.fromOrder !== order);
    this.changes.set(chord ? [...rest, { fromOrder: order, chord }] : rest);
  }

  protected async saveHarmony(p: Phrase): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const updated = await firstValueFrom(
        this.api.updateHarmony(p.id, {
          revision: p.revision,
          key: this.keyText().trim() || undefined,
          chords: this.chordsText().trim() || undefined,
          chordChanges: sortChanges(this.changes()),
        }),
      );
      this.phrase.value.set(updated);
    } catch (err) {
      this.saveError.set(toClientError(err));
    } finally {
      this.saving.set(false);
    }
  }

  protected readonly noteAnalysis = computed(() => {
    const p = this.loaded();
    return analyzeNotes({
      events: p?.events ?? [],
      tuningMidi: p?.context.tuningMidi ?? [],
      capo: p?.context.capo ?? 0,
      key: this.key(),
    });
  });
  protected readonly stringLabels = computed(() =>
    (this.loaded()?.context.tuningMidi ?? []).map((m) =>
      midiToNoteName(m).replace(/-?\d+$/, ''),
    ),
  );
  protected readonly tuningLabel = computed(() => {
    const midi = this.loaded()?.context.tuningMidi ?? [];
    return (
      findTuningPreset(midi)?.label ??
      midi.map((m) => midiToNoteName(m)).join(' ')
    );
  });
}

const sortChanges = (changes: readonly ChordChange[]) =>
  [...changes].sort((a, b) => a.fromOrder - b.fromOrder);
