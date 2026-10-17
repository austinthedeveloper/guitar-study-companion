import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PracticeApi, toClientError } from '@gsc/web/data-access';
import { AlertComponent, ReviewQueueComponent } from '@gsc/web/ui';

@Component({
  selector: 'gsc-review-page',
  imports: [AlertComponent, ReviewQueueComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-4">
      <header>
        <h1 class="text-2xl font-semibold text-stone-900">Review</h1>
        <p class="text-sm text-stone-600">
          Unfinished practice first, then finished plans due for another run,
          then anything built for an older version of a phrase.
        </p>
      </header>
      @if (queue.isLoading()) {
        <p class="text-stone-600" role="status">Loading…</p>
      } @else if (error(); as err) {
        <gsc-alert kind="error" heading="Could not load your review queue">
          <p>{{ err.message }}</p>
          <button
            type="button"
            class="btn-secondary mt-2"
            (click)="queue.reload()"
            data-testid="retry"
          >
            Try again
          </button>
        </gsc-alert>
      } @else if (queue.value(); as items) {
        @if (items.length === 0) {
          <div
            class="rounded border border-dashed border-stone-300 p-8 text-center text-stone-600"
            data-testid="review-empty"
          >
            <p>Nothing to review. Nice.</p>
            <a
              routerLink="/phrases"
              class="mt-2 inline-block text-brand-700 underline"
              >Browse your phrases</a
            >
          </div>
        } @else {
          <gsc-review-queue [items]="items" />
        }
      }
    </section>
  `,
})
export class ReviewPage {
  private readonly api = inject(PracticeApi);
  protected readonly queue = rxResource({ stream: () => this.api.review() });
  protected readonly error = computed(() =>
    this.queue.error() ? toClientError(this.queue.error()) : null,
  );
}
