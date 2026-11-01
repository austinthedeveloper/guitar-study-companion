import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * A destructive action that asks once, inline: the first click shows the
 * question with Confirm and Cancel; only Confirm emits.
 */
@Component({
  selector: 'gsc-confirm-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (asking()) {
      <span
        class="inline-flex flex-wrap items-center gap-2 text-sm"
        role="group"
        [attr.aria-label]="question()"
        data-testid="confirm-group"
      >
        <span class="text-error-ink">{{ question() }}</span>
        <button
          type="button"
          class="inline-flex items-center rounded-md bg-error-ink px-4 py-2 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-50"
          [disabled]="busy()"
          (click)="confirmed.emit()"
          data-testid="confirm-yes"
        >
          {{ busy() ? 'Working…' : confirmLabel() }}
        </button>
        <button
          type="button"
          class="btn-secondary"
          (click)="asking.set(false)"
          data-testid="confirm-cancel"
        >
          Cancel
        </button>
      </span>
    } @else {
      <button
        type="button"
        class="btn-secondary text-error-ink"
        (click)="asking.set(true)"
        data-testid="confirm-start"
      >
        {{ label() }}
      </button>
    }
  `,
})
export class ConfirmButtonComponent {
  readonly label = input.required<string>();
  readonly question = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly busy = input(false);
  readonly confirmed = output<void>();
  protected readonly asking = signal(false);
}
