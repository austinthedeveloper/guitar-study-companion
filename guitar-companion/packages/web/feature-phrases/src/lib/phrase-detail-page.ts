import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  analyzeNotes,
  findTuningPreset,
  formatKey,
  midiToNoteName,
  parseKey,
} from '@gsc/music-domain';
import { Flash, PhrasesApi, toClientError } from '@gsc/web/data-access';
import {
  AlertComponent,
  NoteFactsComponent,
  TabEditorComponent,
} from '@gsc/web/ui';

@Component({
  selector: 'gsc-phrase-detail-page',
  imports: [
    AlertComponent,
    NoteFactsComponent,
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
          @if (p.context.key) {
            <dt class="text-stone-600">Key</dt>
            <dd>{{ p.context.key }}</dd>
          }
          @if (p.context.chords) {
            <dt class="text-stone-600">Chords</dt>
            <dd>{{ p.context.chords }}</dd>
          }
          <dt class="text-stone-600">Rhythm</dt>
          <dd data-testid="phrase-rhythm">
            {{ p.rhythmKnown ? 'Known' : 'Unknown (not transcribed)' }}
          </dd>
          <dt class="text-stone-600">Origin</dt>
          <dd data-testid="phrase-origin">
            {{
              p.draftProvider
                ? 'AI draft (' + p.draftProvider + '), corrected by you'
                : 'Entered manually'
            }}
          </dd>
          <dt class="text-stone-600">Saved</dt>
          <dd>{{ p.createdAt | date: 'medium' }}</dd>
        </dl>
        <gsc-tab-editor
          [events]="events()"
          [rhythmKnown]="p.rhythmKnown"
          [stringCount]="p.context.tuningMidi.length"
          [stringLabels]="stringLabels()"
          [readonly]="true"
        />
        <gsc-note-facts
          [analysis]="noteAnalysis()"
          [keyLabel]="key() ? formatKey(key()!) : null"
          [unparsedKey]="key() ? null : (p.context.key ?? null)"
        />
        <a routerLink="/phrases" class="text-brand-700 underline"
          >All phrases</a
        >
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
  protected readonly error = computed(() =>
    this.phrase.error() ? toClientError(this.phrase.error()) : null,
  );
  protected readonly events = computed(() => this.phrase.value()?.events ?? []);
  protected readonly formatKey = formatKey;
  protected readonly key = computed(() =>
    parseKey(this.phrase.value()?.context.key),
  );
  protected readonly noteAnalysis = computed(() => {
    const p = this.phrase.value();
    return analyzeNotes({
      events: p?.events ?? [],
      tuningMidi: p?.context.tuningMidi ?? [],
      capo: p?.context.capo ?? 0,
      key: this.key(),
    });
  });
  protected readonly stringLabels = computed(() =>
    (this.phrase.value()?.context.tuningMidi ?? []).map((m) =>
      midiToNoteName(m).replace(/-?\d+$/, ''),
    ),
  );
  protected readonly tuningLabel = computed(() => {
    const midi = this.phrase.value()?.context.tuningMidi ?? [];
    return (
      findTuningPreset(midi)?.label ??
      midi.map((m) => midiToNoteName(m)).join(' ')
    );
  });
}
