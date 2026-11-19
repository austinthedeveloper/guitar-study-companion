import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhraseSummary } from '@gsc/contracts';
import { NoteRole } from '@gsc/music-domain';
import { displayRole, roleKind } from '../note-roles/note-roles';

@Component({
  selector: 'gsc-phrase-list',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul
      class="divide-y divide-rule overflow-hidden rounded-[10px] border border-rule bg-paper-raised"
      data-testid="phrase-list"
    >
      @for (p of phrases(); track p.id) {
        <li>
          <a
            [routerLink]="[basePath(), p.id]"
            class="block px-4 py-3 hover:bg-paper-sunk sm:px-5 sm:py-4"
            [attr.data-testid]="'phrase-link-' + p.id"
          >
            <span class="font-semibold text-ink">
              @if (p.favorite) {
                <span
                  class="text-brand-ink"
                  aria-label="Favorite"
                  data-testid="phrase-favorite"
                  >★</span
                >
              }
              {{ p.title }}
            </span>
            <span class="block text-sm text-ink-muted">
              {{ p.source.bookTitle }}
              @if (p.source.page) {
                , p. {{ p.source.page }}
              }
              · {{ p.createdAt | date: 'mediumDate' }}
              @if (p.facets.key) {
                · {{ p.facets.key }}
              }
            </span>
            @if (p.facets.roles.length) {
              <span
                class="mt-1.5 flex overflow-hidden font-mono text-[13px] leading-5"
                [attr.aria-label]="'Roles: ' + rolesText(p.facets.roles)"
                data-testid="phrase-roles"
              >
                @for (r of p.facets.roles; track $index) {
                  <span
                    aria-hidden="true"
                    class="w-7 shrink-0 border-l border-rule text-center first:border-l-0"
                    [class]="'role-' + kind(r)"
                    >{{ label(r) }}</span
                  >
                }
              </span>
            }
            @if (p.tags.length || p.facets.techniques.length) {
              <span class="mt-1 flex flex-wrap gap-1 text-xs">
                @for (t of p.tags; track t) {
                  <span
                    class="rounded bg-brand-tint px-1.5 text-brand-ink"
                    data-testid="phrase-tag"
                    >#{{ t }}</span
                  >
                }
                @for (t of p.facets.techniques; track t) {
                  <span class="rounded bg-paper-sunk px-1.5 text-ink-muted">{{
                    t
                  }}</span>
                }
              </span>
            }
          </a>
        </li>
      }
    </ul>
  `,
})
export class PhraseListComponent {
  readonly phrases = input.required<PhraseSummary[]>();
  readonly basePath = input('/phrases');

  protected kind(role: NoteRole): string {
    return roleKind(role) ?? 'other';
  }

  protected label(role: NoteRole): string {
    return displayRole(role.label);
  }

  protected rolesText(roles: readonly NoteRole[]): string {
    return roles.map((r) => displayRole(r.label)).join(' ');
  }
}
