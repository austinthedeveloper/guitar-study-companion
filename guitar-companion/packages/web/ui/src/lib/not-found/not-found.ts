import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'gsc-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="py-16 text-center" data-testid="not-found">
      <h1 class="text-2xl font-semibold text-stone-900">Page not found</h1>
      <p class="mt-2 text-stone-600">That page doesn't exist.</p>
      <a
        routerLink="/"
        class="mt-6 inline-block rounded bg-brand-700 px-4 py-2 text-white hover:bg-brand-600"
        >Back to home</a
      >
    </section>
  `,
})
export class NotFoundComponent {}
