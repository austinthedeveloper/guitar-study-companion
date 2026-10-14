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
      class="rounded-lg border p-4"
      [class]="tone()"
      [attr.role]="kind() === 'error' ? 'alert' : 'status'"
      [attr.data-kind]="kind()"
      data-testid="alert"
    >
      @if (heading()) {
        <h3 class="font-medium">{{ heading() }}</h3>
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
        info: 'border-sky-300 bg-sky-50 text-sky-900',
        warning: 'border-amber-300 bg-amber-50 text-amber-900',
        error: 'border-red-300 bg-red-50 text-red-900',
        success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
      })[this.kind()],
  );
}
