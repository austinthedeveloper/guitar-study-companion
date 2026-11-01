import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
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
  sliceOrders,
  stepSentence,
} from '@gsc/music-domain';
import {
  ClientError,
  Flash,
  PhrasesApi,
  PracticeApi,
  toClientError,
} from '@gsc/web/data-access';
import {
  AlertComponent,
  ConfirmButtonComponent,
  ExplanationComponent,
  HarmonyFormComponent,
  NoteFactsComponent,
  PhraseMetaComponent,
  PhraseMetaValue,
  PracticeHistoryComponent,
  ScaleCandidatesComponent,
  displayRole,
  noteText,
  roleKind,
  tabAnnotations,
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
    PhraseMetaComponent,
    PracticeHistoryComponent,
    ConfirmButtonComponent,
    ScaleCandidatesComponent,
    TabEditorComponent,
    RouterLink,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (phrase.isLoading()) {
      <p class="text-ink-muted" role="status">Loading…</p>
    } @else if (error(); as err) {
      @if (err.code === 'not_found') {
        <section class="py-12 text-center" data-testid="phrase-not-found">
          <h1 class="h1">Phrase not found</h1>
          <p class="mt-2 text-ink-muted">
            It may have been deleted, or the link is wrong.
          </p>
          <a
            routerLink="/phrases"
            class="mt-4 inline-block text-brand-ink underline"
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
        <header class="flex flex-wrap items-start gap-x-6 gap-y-3">
          <div class="min-w-0 flex-[1_1_320px]">
            <h1 class="h1" data-testid="phrase-heading">
              {{ p.title }}
            </h1>
            <p class="mt-1 text-sm text-ink-muted" data-testid="phrase-source">
              {{ p.source.bookTitle }}
              @if (p.source.songTitle) {
                · {{ p.source.songTitle }}
              }
              @if (p.source.page) {
                · p. {{ p.source.page }}
              }
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a
              [routerLink]="['/phrases', p.id, 'transpose']"
              class="btn-secondary"
              data-testid="transpose-link"
              >Transpose and vary</a
            >
            <a
              [routerLink]="['/phrases', p.id, 'practice']"
              class="btn-primary"
              data-testid="practice-link"
              >Practice this phrase</a
            >
          </div>
        </header>
        <dl
          class="flex flex-wrap gap-x-6 gap-y-1 text-sm [&_dt]:text-ink-muted [&>div]:flex [&>div]:gap-2"
        >
          <div>
            <dt>Tuning</dt>
            <dd data-testid="phrase-tuning">{{ tuningLabel() }}</dd>
          </div>
          <div>
            <dt>Capo</dt>
            <dd>{{ p.context.capo || 'None' }}</dd>
          </div>
          <div>
            <dt>Rhythm</dt>
            <dd data-testid="phrase-rhythm">
              {{ p.rhythmKnown ? 'Known' : 'Unknown (not transcribed)' }}
            </dd>
          </div>
          <div>
            <dt>Origin</dt>
            <dd data-testid="phrase-origin">
              @if (p.derivedFrom; as d) {
                {{ d.change }} from
                <a
                  [routerLink]="['/phrases', d.phraseId]"
                  class="link"
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
          </div>
          <div>
            <dt>Saved</dt>
            <dd>{{ p.createdAt | date: 'medium' }}</dd>
          </div>
        </dl>

        <section
          aria-label="Annotated tab"
          class="flex flex-wrap gap-6 rounded-[10px] border border-rule bg-paper-raised p-4 sm:p-6"
        >
          <gsc-tab-editor
            class="block min-w-0 flex-[999_1_480px] [&_[role=group]]:border-0 [&_[role=group]]:p-0"
            [events]="events()"
            [rhythmKnown]="p.rhythmKnown"
            [stringCount]="p.context.tuningMidi.length"
            [stringLabels]="stringLabels()"
            [readonly]="true"
            [roles]="roles()"
            [columnChords]="columnChords()"
            [highlightIds]="highlightIds()"
            [annotations]="annotations()"
            [selectable]="true"
            [activeColumn]="activeOrder()"
            (columnPick)="selectedOrder.set($event)"
          />
          @if (activeNote(); as n) {
            <aside
              class="flex min-w-0 flex-[1_1_220px] flex-col gap-2 border-rule sm:border-l sm:pl-6"
              aria-live="polite"
              data-testid="note-panel"
            >
              <p
                class="text-xs font-medium tracking-[0.06em] text-ink-muted uppercase"
              >
                Note {{ n.index + 1 }}
              </p>
              <p class="font-display text-[30px] leading-9 font-[560]">
                {{ n.names }}
                @if (n.chord && n.roles.length) {
                  <span class="font-sans text-base font-medium">
                    @for (r of n.roles; track $index) {
                      <span [class]="r.cls">{{ r.label }}</span>
                      {{ ' ' }}
                    }
                    <span class="text-ink-muted">of {{ n.chord }}</span>
                  </span>
                }
              </p>
              <p class="text-sm text-ink-muted">{{ n.where }}</p>
              @if (n.step) {
                <p class="text-sm">{{ n.step }}</p>
              }
            </aside>
          }
        </section>

        <section aria-label="Study" class="space-y-5">
          <div
            role="tablist"
            aria-label="Study"
            class="flex gap-6 overflow-x-auto border-b border-rule"
          >
            @for (t of studyTabs; track t.key) {
              <button
                type="button"
                role="tab"
                class="-mb-px shrink-0 border-b-2 px-0.5 py-2.5 text-sm font-medium"
                [class]="
                  tab() === t.key
                    ? 'border-brand text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink'
                "
                [id]="'study-tab-' + t.key"
                [attr.aria-selected]="tab() === t.key"
                [attr.aria-controls]="'study-panel-' + t.key"
                [attr.data-testid]="'study-tab-' + t.key"
                (click)="tab.set(t.key)"
              >
                {{ t.label }}
              </button>
            }
          </div>
          <div
            role="tabpanel"
            class="space-y-5"
            [id]="'study-panel-' + tab()"
            [attr.aria-labelledby]="'study-tab-' + tab()"
          >
            @switch (tab()) {
              @case ('notes') {
                <gsc-harmony-form
                  class="block"
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
                  class="block"
                  [analysis]="noteAnalysis()"
                  [keyLabel]="key() ? formatKey(key()!) : null"
                  [unparsedKey]="key() ? null : keyText().trim() || null"
                  [roles]="roles()"
                  [columnChords]="columnChords()"
                  [chordOptions]="chordOptions()"
                  [chordStarts]="chordStarts()"
                  (chordChange)="placeChord($event.order, $event.chord)"
                />
              }
              @case ('why') {
                <gsc-explanation
                  class="block"
                  [explanation]="p.explanation ?? null"
                  [stale]="
                    !!p.explanation &&
                    p.explanation.phraseRevision !== p.revision
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
              }
              @case ('scales') {
                <gsc-scale-candidates class="block" [analysis]="scales()" />
              }
              @case ('library') {
                <gsc-phrase-meta
                  class="block"
                  [value]="{
                    tags: p.tags,
                    favorite: p.favorite,
                    notes: p.notes ?? '',
                  }"
                  [saving]="metaSaving()"
                  [status]="metaStatus()"
                  (save)="saveMeta(p, $event)"
                />
                <gsc-practice-history
                  class="block"
                  [entries]="history.value() ?? []"
                />
              }
            }
          </div>
        </section>

        <footer
          class="flex flex-wrap items-center gap-4 border-t border-rule pt-4"
        >
          <a routerLink="/phrases" class="link">All phrases</a>
          <span class="ml-auto" data-testid="phrase-delete">
            <gsc-confirm-button
              label="Delete phrase"
              question="Delete this phrase and its practice history?"
              confirmLabel="Delete"
              [busy]="deleting()"
              (confirmed)="deletePhrase(p)"
            />
          </span>
        </footer>
      </article>
    }
  `,
})
export class PhraseDetailPage {
  /** Bound from the route parameter. */
  readonly id = input.required<string>();
  private readonly api = inject(PhrasesApi);
  private readonly flash = inject(Flash);
  protected readonly justSaved = this.flash.consume('phrase-saved');

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
  protected readonly studyTabs = STUDY_TABS;
  protected readonly tab = signal<StudyTab>('notes');
  /** Column picked in the tab; the first column until the user picks one. */
  protected readonly selectedOrder = signal<number | null>(null);
  private readonly orders = computed(() => sliceOrders(this.events()));
  protected readonly activeOrder = computed(() => {
    const picked = this.selectedOrder();
    return picked !== null && this.orders().includes(picked)
      ? picked
      : (this.orders()[0] ?? null);
  });
  /** Facts per tab column for the rows under the strings. */
  protected readonly annotations = computed(() =>
    tabAnnotations(this.orders(), this.noteAnalysis(), this.roles()),
  );
  /** The picked column, described for the note panel. */
  protected readonly activeNote = computed(() => {
    const order = this.activeOrder();
    if (order === null) return null;
    const index = this.orders().indexOf(order);
    const col = this.noteAnalysis().columns.find((c) => c.order === order);
    const roles = this.roles();
    const labels = this.stringLabels();
    const events = this.events()
      .filter((e) => e.order === order)
      .sort((a, b) => a.stringIndex - b.stringIndex);
    return {
      index,
      names: (col?.notes ?? []).map(noteText).join(' + ') || '—',
      chord: this.columnChords()[index] ?? null,
      roles: (col?.notes ?? []).flatMap((n) => {
        const r = roles[n.eventId]?.note;
        return r
          ? [{ label: displayRole(r.label), cls: `role-${roleKind(r)}` }]
          : [];
      }),
      where: events
        .map(
          (e) =>
            `${labels[e.stringIndex] ?? e.stringIndex + 1} string, ` +
            (e.fret === null ? 'dead note' : `fret ${e.fret}`),
        )
        .join(' · '),
      step: col ? stepSentence(col.fromPrevious, col.chordIntervals) : null,
    };
  });
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

  private readonly practiceApi = inject(PracticeApi);
  protected readonly history = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.practiceApi.history(params),
  });
  private readonly router = inject(Router);
  protected readonly deleting = signal(false);

  protected async deletePhrase(p: Phrase): Promise<void> {
    this.deleting.set(true);
    try {
      await firstValueFrom(this.api.delete(p.id));
      this.flash.set('phrase-deleted');
      await this.router.navigate(['/phrases']);
    } catch (err) {
      this.metaStatus.set(`Not deleted: ${toClientError(err).message}`);
    } finally {
      this.deleting.set(false);
    }
  }

  protected readonly metaSaving = signal(false);
  protected readonly metaStatus = signal<string | null>(null);

  protected async saveMeta(p: Phrase, meta: PhraseMetaValue): Promise<void> {
    this.metaSaving.set(true);
    this.metaStatus.set(null);
    try {
      const updated = await firstValueFrom(this.api.updateMeta(p.id, meta));
      // Library fields don't touch the music, so no revision or stale state.
      this.phrase.value.set(updated);
      this.metaStatus.set('Saved');
    } catch (err) {
      this.metaStatus.set(`Not saved: ${toClientError(err).message}`);
    } finally {
      this.metaSaving.set(false);
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
    // Reset harmony edits only for a different phrase or revision, so saving
    // library fields (which replaces the loaded phrase) keeps unsaved edits.
    const version = computed(
      () => `${this.loaded()?.id}:${this.loaded()?.revision}`,
    );
    effect(() => {
      version();
      const ctx = untracked(() => this.loaded()?.context);
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

type StudyTab = 'notes' | 'why' | 'scales' | 'library';
const STUDY_TABS: { key: StudyTab; label: string }[] = [
  { key: 'notes', label: 'Notes and harmony' },
  { key: 'why', label: 'Why it works' },
  { key: 'scales', label: 'Likely scales' },
  { key: 'library', label: 'Library and history' },
];

const sortChanges = (changes: readonly ChordChange[]) =>
  [...changes].sort((a, b) => a.fromOrder - b.fromOrder);
