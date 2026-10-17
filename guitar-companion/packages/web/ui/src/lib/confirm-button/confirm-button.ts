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
        <span class="text-red-800">{{ question() }}</span>
        <button
          type="button"
          class="rounded bg-red-700 px-3 py-1.5 text-white hover:bg-red-800 disabled:opacity-50"
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
        class="btn-secondary text-red-800"
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
