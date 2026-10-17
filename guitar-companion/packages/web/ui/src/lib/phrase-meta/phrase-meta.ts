import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

export interface PhraseMetaValue {
  tags: string[];
  favorite: boolean;
  notes: string;
}

/** Favorite, tags, and the player's own notes for a phrase. */
@Component({
  selector: 'gsc-phrase-meta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="space-y-3 rounded-lg border border-stone-300 bg-white p-4"
      aria-labelledby="meta-heading"
      data-testid="phrase-meta"
    >
      <header class="flex items-center gap-3">
        <h2 id="meta-heading" class="text-lg font-semibold">In your library</h2>
        <button
          type="button"
          class="btn-secondary"
          [attr.aria-pressed]="favorite()"
          (click)="favorite.set(!favorite())"
          data-testid="meta-favorite"
        >
          {{ favorite() ? '★ Favorite' : '☆ Add to favorites' }}
        </button>
      </header>
      <label class="block text-sm">
        <span class="block text-stone-700">Tags (comma-separated)</span>
        <input
          class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
          autocomplete="off"
          placeholder="e.g. blues, warmup"
          [value]="tagsText()"
          (input)="tagsText.set($any($event.target).value)"
          data-testid="meta-tags"
        />
      </label>
      <label class="block text-sm">
        <span class="block text-stone-700">Your notes</span>
        <textarea
          class="mt-1 w-full rounded border border-stone-300 p-2"
          rows="3"
          [value]="notes()"
          (input)="notes.set($any($event.target).value)"
          data-testid="meta-notes"
        ></textarea>
      </label>
      <div class="flex items-center gap-3 text-sm">
        <button
          type="button"
          class="btn-primary"
          [disabled]="!dirty() || saving()"
          (click)="save.emit(current())"
          data-testid="meta-save"
        >
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
        @if (status()) {
          <span class="text-stone-600" data-testid="meta-status">{{
            status()
          }}</span>
        }
      </div>
    </section>
  `,
})
export class PhraseMetaComponent {
  readonly value = input.required<PhraseMetaValue>();
  readonly saving = input(false);
  /** e.g. "Saved" or an error message. */
  readonly status = input<string | null>(null);
  readonly save = output<PhraseMetaValue>();

  protected readonly favorite = signal(false);
  protected readonly tagsText = signal('');
  protected readonly notes = signal('');
  protected readonly current = computed<PhraseMetaValue>(() => ({
    favorite: this.favorite(),
    tags: this.tagsText()
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    notes: this.notes(),
  }));
  protected readonly dirty = computed(
    () => JSON.stringify(this.current()) !== JSON.stringify(this.value()),
  );

  constructor() {
    effect(() => {
      const v = this.value();
      this.favorite.set(v.favorite);
      this.tagsText.set(v.tags.join(', '));
      this.notes.set(v.notes);
    });
  }
}
