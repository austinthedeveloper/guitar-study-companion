import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'gsc-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rounded-md border px-4 py-3"
      [class]="tone()"
      [attr.role]="kind() === 'error' ? 'alert' : 'status'"
      [attr.data-kind]="kind()"
      data-testid="alert"
    >
      @if (heading()) {
        <h3 class="font-semibold">{{ heading() }}</h3>
      }
      <div class="text-sm" [class.mt-1]="!!heading()"><ng-content /></div>
    </div>
  `,
})
export class AlertComponent {
  readonly kind = input<'info' | 'warning' | 'error' | 'success'>('info');
  readonly heading = input<string>('');
  protected readonly tone = computed(
    () =>
      ({
        info: 'border-info-line bg-info-tint text-info-ink',
        warning: 'border-uncertain-line bg-uncertain-tint text-uncertain-ink',
        error: 'border-error-line bg-error-tint text-error-ink',
        success: 'border-success-line bg-success-tint text-success-ink',
      })[this.kind()],
  );
}
