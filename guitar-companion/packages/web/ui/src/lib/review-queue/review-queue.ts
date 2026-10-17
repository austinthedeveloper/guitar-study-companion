import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReviewItem } from '@gsc/contracts';

const LABELS: Record<ReviewItem['kind'], string> = {
  unfinished: 'Keep going',
  due: 'Review',
  'stale-plan': 'Rebuild plan',
  'stale-explanation': 'Update explanation',
  'not-started': 'Start practising',
};

/** What needs attention next; each item links to where to act on it. */
@Component({
  selector: 'gsc-review-queue',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul
      class="divide-y divide-stone-200 rounded border border-stone-200 bg-white"
      data-testid="review-queue"
    >
      @for (item of items(); track item.phraseId + item.kind) {
        <li
          class="flex flex-wrap items-center gap-3 px-4 py-3"
          data-testid="review-item"
          [attr.data-kind]="item.kind"
        >
          <div class="min-w-0 flex-1">
            <span class="font-medium text-stone-900">{{ item.title }}</span>
            <span class="block text-sm text-stone-600">
              {{ item.detail }}
              @if (item.at) {
                · {{ item.at | date: 'mediumDate' }}
              }
            </span>
          </div>
          <a
            [routerLink]="linkFor(item)"
            class="btn-secondary"
            data-testid="review-action"
            >{{ labels[item.kind] }}</a
          >
        </li>
      }
    </ul>
  `,
})
export class ReviewQueueComponent {
  readonly items = input.required<readonly ReviewItem[]>();
  protected readonly labels = LABELS;

  protected linkFor(item: ReviewItem): string[] {
    return item.kind === 'stale-explanation'
      ? ['/phrases', item.phraseId]
      : ['/phrases', item.phraseId, 'practice'];
  }
}
