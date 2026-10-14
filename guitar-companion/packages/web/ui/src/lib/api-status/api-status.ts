import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type ApiStatusView =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | {
      state: 'ok' | 'degraded';
      version: string;
      database: string;
      aiProvider: string;
    };

const LABELS: Record<ApiStatusView['state'], string> = {
  loading: 'Checking API…',
  ok: 'API online',
  degraded: 'API degraded',
  error: 'API unreachable',
};

/** Displays backend health. Purely presentational. */
@Component({
  selector: 'gsc-api-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="rounded-lg border p-4"
      [class]="tone()"
      role="status"
      aria-live="polite"
      data-testid="api-status"
      [attr.data-state]="status().state"
    >
      <h2 class="font-medium">{{ label() }}</h2>
      @switch (status().state) {
        @case ('error') {
          <p class="mt-1 text-sm">{{ errorMessage() }}</p>
        }
        @case ('loading') {}
        @default {
          <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt>Version</dt>
            <dd data-testid="api-version">{{ detail()?.version }}</dd>
            <dt>Database</dt>
            <dd data-testid="api-database">{{ detail()?.database }}</dd>
            <dt>AI provider</dt>
            <dd data-testid="api-ai-provider">{{ detail()?.aiProvider }}</dd>
          </dl>
        }
      }
    </section>
  `,
})
export class ApiStatusComponent {
  readonly status = input.required<ApiStatusView>();

  protected readonly label = computed(() => LABELS[this.status().state]);
  protected readonly detail = computed(() => {
    const s = this.status();
    return s.state === 'ok' || s.state === 'degraded' ? s : null;
  });
  protected readonly errorMessage = computed(() => {
    const s = this.status();
    return s.state === 'error' ? s.message : '';
  });
  protected readonly tone = computed(() => {
    switch (this.status().state) {
      case 'ok':
        return 'border-emerald-300 bg-emerald-50 text-emerald-900';
      case 'degraded':
        return 'border-amber-300 bg-amber-50 text-amber-900';
      case 'error':
        return 'border-red-300 bg-red-50 text-red-900';
      default:
        return 'border-stone-200 bg-stone-50 text-stone-800';
    }
  });
}
