import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface NavLink {
  label: string;
  path: string;
}

/** Page chrome: header, primary nav, and projected main content. */
@Component({
  selector: 'gsc-app-shell',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >Skip to content</a
    >
    <header class="border-b border-stone-200 bg-white">
      <div
        class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3"
      >
        <a
          routerLink="/"
          class="text-lg font-semibold text-stone-900"
          data-testid="brand"
          >{{ title() }}</a
        >
        <nav aria-label="Primary">
          <ul class="flex gap-4 text-sm">
            @for (link of links(); track link.path) {
              <li>
                <a
                  [routerLink]="link.path"
                  routerLinkActive="text-brand-700 font-medium"
                  [routerLinkActiveOptions]="{ exact: true }"
                  ariaCurrentWhenActive="page"
                  class="text-stone-700 hover:text-stone-900"
                  >{{ link.label }}</a
                >
              </li>
            }
          </ul>
        </nav>
      </div>
    </header>
    <main id="main" class="mx-auto max-w-5xl px-4 py-8">
      <ng-content />
    </main>
  `,
})
export class AppShellComponent {
  readonly title = input.required<string>();
  readonly links = input<NavLink[]>([]);
}
