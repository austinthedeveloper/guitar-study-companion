import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PracticeHistoryEntry } from '@gsc/contracts';

/** Practice plans built for a phrase, newest first, with progress. */
@Component({
  selector: 'gsc-practice-history',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="space-y-2 rounded-lg border border-stone-300 bg-white p-4"
      aria-labelledby="history-heading"
      data-testid="practice-history"
    >
      <h2 id="history-heading" class="text-lg font-semibold">
        Practice history
      </h2>
      @if (entries().length === 0) {
        <p class="text-sm text-stone-600" data-testid="history-empty">
          Not practised yet.
        </p>
      } @else {
        <ul class="space-y-1 text-sm">
          @for (e of entries(); track e.planId) {
            <li data-testid="history-entry">
              {{ e.createdAt | date: 'mediumDate' }}:
              {{ e.settings.difficulty }}, {{ e.settings.minutes }} min,
              {{ e.settings.focus }} ·
              <span class="font-medium"
                >{{ e.completed }} of {{ e.exercises }} done</span
              >
              @if (e.lastPracticed) {
                · last practised {{ e.lastPracticed | date: 'mediumDate' }}
              }
              @if (e.stale) {
                <span class="text-amber-800">
                  · built for an earlier version</span
                >
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class PracticeHistoryComponent {
  readonly entries = input.required<readonly PracticeHistoryEntry[]>();
}
