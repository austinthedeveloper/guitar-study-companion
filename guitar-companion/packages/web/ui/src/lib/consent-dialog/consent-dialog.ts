import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

/** Explicit consent before an image leaves the user's device for an AI provider. */
@Component({
  selector: 'gsc-consent-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="m-auto max-w-lg rounded-[10px] border border-rule bg-paper-raised p-0 text-ink shadow-dialog backdrop:bg-scrim"
      aria-labelledby="consent-title"
      data-testid="consent-dialog"
      (cancel)="$event.preventDefault(); declined.emit()"
    >
      <div class="space-y-3 p-6">
        <h2 id="consent-title" class="h2">
          Send this selection for recognition?
        </h2>
        <p class="text-sm text-ink-muted">
          Only the selected area (not the whole page) will be sent to
          <strong class="text-ink">{{ providerLabel() }}</strong> to read the
          tablature. The image is not saved by this app.
        </p>
        <p class="text-sm text-ink-muted">
          Only send pages from books you own, for your personal study.
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="btn-secondary"
            (click)="declined.emit()"
            data-testid="consent-decline"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-primary"
            (click)="confirmed.emit()"
            data-testid="consent-confirm"
          >
            Send selection
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class ConsentDialogComponent {
  readonly open = input(false);
  readonly providerLabel = input('the AI provider');
  readonly confirmed = output<void>();
  readonly declined = output<void>();
  private readonly dialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.open() && !el.open) el.showModal?.();
      if (!this.open() && el.open) el.close();
    });
  }
}
