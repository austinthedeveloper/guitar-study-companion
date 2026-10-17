import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { TECHNIQUES } from '@gsc/contracts';

/** Search fields for the phrase library. Presentational; the page queries. */
@Component({
  selector: 'gsc-library-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="grid gap-3 rounded-lg border border-stone-300 bg-white p-4 text-sm sm:grid-cols-3"
      role="search"
      aria-label="Search phrases"
      data-testid="library-filters"
      (submit)="$event.preventDefault()"
    >
      <label class="sm:col-span-3">
        <span class="block text-stone-700">Search</span>
        <input
          type="search"
          class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
          placeholder="Title, book, song, notes, or tag"
          [value]="q()"
          (input)="q.set($any($event.target).value)"
          data-testid="filter-q"
        />
      </label>
      <label>
        <span class="block text-stone-700">Key</span>
        <input
          class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
          placeholder="e.g. Am"
          autocomplete="off"
          [value]="key()"
          (input)="key.set($any($event.target).value)"
          data-testid="filter-key"
        />
      </label>
      <label>
        <span class="block text-stone-700">Technique</span>
        <select
          class="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1"
          (change)="technique.set($any($event.target).value)"
          data-testid="filter-technique"
        >
          <option value="" [selected]="!technique()">Any</option>
          @for (t of techniques; track t) {
            <option [value]="t" [selected]="technique() === t">{{ t }}</option>
          }
        </select>
      </label>
      <label>
        <span class="block text-stone-700">Tag</span>
        <input
          class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
          placeholder="e.g. blues"
          autocomplete="off"
          [value]="tag()"
          (input)="tag.set($any($event.target).value)"
          data-testid="filter-tag"
        />
      </label>
      <label class="sm:col-span-2">
        <span class="block text-stone-700">Interval pattern</span>
        <input
          class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
          placeholder="e.g. m3 down, M2 up"
          autocomplete="off"
          [value]="interval()"
          (input)="interval.set($any($event.target).value)"
          data-testid="filter-interval"
        />
      </label>
      <label class="flex items-center gap-2 self-end pb-1">
        <input
          type="checkbox"
          [checked]="favorite()"
          (change)="favorite.set($any($event.target).checked)"
          data-testid="filter-favorite"
        />
        Favorites only
      </label>
    </form>
  `,
})
export class LibraryFiltersComponent {
  readonly q = model('');
  readonly key = model('');
  readonly technique = model('');
  readonly tag = model('');
  readonly interval = model('');
  readonly favorite = model(false);
  protected readonly techniques = TECHNIQUES;
}
