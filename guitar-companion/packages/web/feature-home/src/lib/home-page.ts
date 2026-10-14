import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HealthApi } from '@gsc/web/data-access';
import { RouterLink } from '@angular/router';
import { ApiStatusComponent, ApiStatusView } from '@gsc/web/ui';

@Component({
  selector: 'gsc-home-page',
  imports: [ApiStatusComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-3">
      <h1 class="text-3xl font-semibold text-stone-900">
        Learn from music, not just learn to play music.
      </h1>
      <p class="max-w-2xl text-stone-700">
        Turn passages from your guitar books into vocabulary you can understand,
        practice, and use in your own playing.
      </p>
      <div class="flex gap-3 pt-2">
        <a routerLink="/import" class="btn-primary" data-testid="cta-import"
          >Import a passage</a
        >
        <a routerLink="/phrases" class="btn-secondary" data-testid="cta-phrases"
          >My phrases</a
        >
      </div>
    </section>
    <div class="mt-8 max-w-md">
      <gsc-api-status [status]="status()" />
    </div>
  `,
})
export class HomePage {
  private readonly api = inject(HealthApi);
  private readonly health = rxResource({ stream: () => this.api.getHealth() });

  protected readonly status = computed<ApiStatusView>(() => {
    if (this.health.error())
      return {
        state: 'error',
        message: 'Could not reach the API. Try again shortly.',
      };
    const h = this.health.value();
    if (!h) return { state: 'loading' };
    return {
      state: h.status,
      version: h.version,
      database: h.checks.database,
      aiProvider: h.checks.aiProvider,
    };
  });
}
