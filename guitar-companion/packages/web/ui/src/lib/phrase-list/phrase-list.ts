import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhraseSummary } from '@gsc/contracts';

@Component({
  selector: 'gsc-phrase-list',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul
      class="divide-y divide-stone-200 rounded border border-stone-200 bg-white"
      data-testid="phrase-list"
    >
      @for (p of phrases(); track p.id) {
        <li>
          <a
            [routerLink]="[basePath(), p.id]"
            class="block px-4 py-3 hover:bg-stone-50"
            [attr.data-testid]="'phrase-link-' + p.id"
          >
            <span class="font-medium text-stone-900">{{ p.title }}</span>
            <span class="block text-sm text-stone-600">
              {{ p.source.bookTitle }}
              @if (p.source.page) {
                , p. {{ p.source.page }}
              }
              · {{ p.createdAt | date: 'mediumDate' }}
            </span>
          </a>
        </li>
      }
    </ul>
  `,
})
export class PhraseListComponent {
  readonly phrases = input.required<PhraseSummary[]>();
  readonly basePath = input('/phrases');
}
