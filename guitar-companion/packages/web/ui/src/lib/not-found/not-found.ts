import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'gsc-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="py-16 text-center" data-testid="not-found">
      <h1 class="h1">Page not found</h1>
      <p class="mt-2 text-ink-muted">That page doesn't exist.</p>
      <a routerLink="/" class="btn-primary mt-6">Back to home</a>
    </section>
  `,
})
export class NotFoundComponent {}
