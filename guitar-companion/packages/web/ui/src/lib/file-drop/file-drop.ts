import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';

/** File picker with drag-and-drop. Emits the chosen file; validation is the caller's job. */
@Component({
  selector: 'gsc-file-drop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center"
      [class]="
        dragging()
          ? 'border-brand bg-brand-tint'
          : 'border-rule-strong bg-paper-raised hover:bg-paper-sunk'
      "
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
      data-testid="file-drop"
    >
      <span class="font-medium text-ink">{{ label() }}</span>
      <span class="text-sm text-ink-muted">{{ hint() }}</span>
      <input
        type="file"
        class="sr-only"
        [accept]="accept()"
        [disabled]="busy()"
        (change)="onChange($event)"
        data-testid="file-input"
      />
    </label>
  `,
})
export class FileDropComponent {
  readonly accept = input('');
  readonly label = input('Choose a photo or drop it here');
  readonly hint = input('');
  readonly busy = input(false);
  readonly fileSelected = output<File>();
  protected readonly dragging = signal(false);

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.fileSelected.emit(file);
  }

  protected onChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    if (file) this.fileSelected.emit(file);
    el.value = '';
  }
}
