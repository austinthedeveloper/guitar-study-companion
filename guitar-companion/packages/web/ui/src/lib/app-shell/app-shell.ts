import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface NavLink {
  label: string;
  path: string;
}

/**
 * Page chrome: header, primary nav, and projected main content.
 * The brand input is deliberately not named `title`: a static `title="…"` on
 * the host element stays in the DOM and shows as a tooltip over the whole page.
 */
@Component({
  selector: 'gsc-app-shell',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-paper-raised focus:px-3 focus:text-ink focus:py-2"
      >Skip to content</a
    >
    <header class="masthead">
      <div
        class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-8 sm:py-4"
      >
        <a
          routerLink="/"
          class="font-display text-lg font-semibold text-ink"
          data-testid="brand"
          >{{ brand() }}</a
        >
        <nav aria-label="Primary">
          <ul class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            @for (link of links(); track link.path) {
              <li>
                <a
                  [routerLink]="link.path"
                  routerLinkActive="!text-brand-ink font-semibold"
                  [routerLinkActiveOptions]="{ exact: true }"
                  ariaCurrentWhenActive="page"
                  class="text-ink-muted hover:text-ink"
                  >{{ link.label }}</a
                >
              </li>
            }
          </ul>
        </nav>
      </div>
    </header>
    <main id="main" class="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <ng-content />
    </main>
    @if (footerLinks().length) {
      <footer
        class="mx-auto max-w-5xl border-t border-rule px-4 py-6 text-sm text-ink-muted sm:px-8"
      >
        <nav aria-label="Footer">
          @for (link of footerLinks(); track link.path) {
            <a [routerLink]="link.path" class="link">{{ link.label }}</a>
          }
        </nav>
      </footer>
    }
  `,
})
export class AppShellComponent {
  readonly brand = input.required<string>();
  readonly links = input<NavLink[]>([]);
  readonly footerLinks = input<NavLink[]>([]);
}
