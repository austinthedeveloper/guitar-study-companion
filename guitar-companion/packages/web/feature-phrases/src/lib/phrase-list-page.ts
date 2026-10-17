import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { PhraseQuery } from '@gsc/contracts';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PhrasesApi, toClientError } from '@gsc/web/data-access';
import {
  AlertComponent,
  LibraryFiltersComponent,
  PhraseListComponent,
} from '@gsc/web/ui';

@Component({
  selector: 'gsc-phrase-list-page',
  imports: [
    AlertComponent,
    LibraryFiltersComponent,
    PhraseListComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold text-stone-900">My phrases</h1>
        <a routerLink="/import" class="btn-primary" data-testid="import-link"
          >Import a passage</a
        >
      </div>
      <gsc-library-filters
        [(q)]="q"
        [(key)]="key"
        [(technique)]="technique"
        [(tag)]="tag"
        [(interval)]="interval"
        [(favorite)]="favorite"
      />
      @if (phrases.isLoading() && !phrases.hasValue()) {
        <p class="text-stone-600" role="status">Loading…</p>
      } @else if (error(); as err) {
        @if (err.code === 'validation_failed') {
          <p class="text-sm text-amber-800" data-testid="library-search-error">
            {{ err.issues?.[0]?.message ?? err.message }}
          </p>
        } @else {
          <gsc-alert kind="error" heading="Could not load phrases">
            <p>{{ err.message }}</p>
            <button
              type="button"
              class="btn-secondary mt-2"
              (click)="phrases.reload()"
              data-testid="retry"
            >
              Try again
            </button>
          </gsc-alert>
        }
      } @else if (phrases.value(); as list) {
        @if (list.length === 0 && filtering()) {
          <p class="text-stone-600" data-testid="library-no-match">
            No phrases match this search.
          </p>
        } @else if (list.length === 0) {
          <div
            class="rounded border border-dashed border-stone-300 p-8 text-center text-stone-600"
            data-testid="phrases-empty"
          >
            <p>No saved phrases yet.</p>
            <a
              routerLink="/import"
              class="mt-2 inline-block text-brand-700 underline"
              >Import your first passage</a
            >
          </div>
        } @else {
          <gsc-phrase-list [phrases]="list" />
        }
      }
    </div>
  `,
})
export class PhraseListPage {
  private readonly api = inject(PhrasesApi);
  protected readonly q = signal('');
  protected readonly key = signal('');
  protected readonly technique = signal('');
  protected readonly tag = signal('');
  protected readonly interval = signal('');
  protected readonly favorite = signal(false);
  /** What's typed, without empty fields (so "nothing typed" equals {}). */
  private readonly typed = computed<PhraseQuery>(() =>
    Object.fromEntries(
      Object.entries({
        q: this.q().trim(),
        key: this.key().trim(),
        technique: this.technique(),
        tag: this.tag().trim(),
        interval: this.interval().trim(),
        favorite: this.favorite() ? 'true' : '',
      }).filter(([, v]) => v),
    ),
  );
  /** The query actually sent: settles 300 ms after the last keystroke. */
  private readonly query = signal<PhraseQuery>({});
  protected readonly filtering = computed(() =>
    Object.values(this.query()).some((v) => v),
  );
  protected readonly phrases = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });

  constructor() {
    effect((onCleanup) => {
      const next = this.typed();
      if (JSON.stringify(next) === JSON.stringify(untracked(this.query)))
        return;
      const timer = setTimeout(() => this.query.set(next), 300);
      onCleanup(() => clearTimeout(timer));
    });
  }
  protected readonly error = computed(() =>
    this.phrases.error() ? toClientError(this.phrases.error()) : null,
  );
}
