import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PhrasesApi, toClientError } from '@gsc/web/data-access';
import { AlertComponent, PhraseListComponent } from '@gsc/web/ui';

@Component({
  selector: 'gsc-phrase-list-page',
  imports: [AlertComponent, PhraseListComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold text-stone-900">My phrases</h1>
        <a routerLink="/import" class="btn-primary" data-testid="import-link"
          >Import a passage</a
        >
      </div>
      @if (phrases.isLoading()) {
        <p class="text-stone-600" role="status">Loading…</p>
      } @else if (error(); as err) {
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
      } @else if (phrases.value(); as list) {
        @if (list.length === 0) {
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
  protected readonly phrases = rxResource({ stream: () => this.api.list() });
  protected readonly error = computed(() =>
    this.phrases.error() ? toClientError(this.phrases.error()) : null,
  );
}
