import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';
import { Technique } from '@gsc/contracts';
import {
  deleteSlice,
  EventIssue,
  formatRoles,
  NoteRoles,
  insertSliceBefore,
  moveSlice,
  setNote,
  sliceOrders,
  updateEvent,
} from '@gsc/music-domain';
import {
  BEND_OPTIONS,
  cellText,
  DURATION_OPTIONS,
  EditorEvent,
  LOW_CONFIDENCE,
  parseCell,
  TECHNIQUE_OPTIONS,
} from './tab-editor-model';

/**
 * Tab correction grid: one row per string (top = highest), one column per
 * position. Purely presentational: state flows in via `events` and out via
 * two-way binding. Validation issues and uncertainty come in as inputs.
 */
@Component({
  selector: 'gsc-tab-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4" data-testid="tab-editor">
      @if (!readonly()) {
        <div class="flex flex-wrap items-center gap-4 text-sm">
          <label class="inline-flex items-center gap-2">
            <input
              type="checkbox"
              [checked]="rhythmKnown()"
              (change)="toggleRhythm($any($event.target).checked)"
              data-testid="rhythm-known"
            />
            Rhythm is known
          </label>
          @if (!rhythmKnown()) {
            <span class="text-stone-600" data-testid="rhythm-unknown-note"
              >Durations are left empty; nothing is guessed from spacing.</span
            >
          }
          <span class="ml-auto inline-flex items-center gap-2 text-stone-600">
            <span
              class="inline-block h-3 w-3 rounded-sm bg-amber-200 ring-1 ring-amber-400"
            ></span>
            Needs review
            <span
              class="ml-2 inline-block h-3 w-3 rounded-sm bg-red-100 ring-2 ring-red-500"
            ></span>
            Invalid
          </span>
        </div>
      }

      @if (columns().length === 0) {
        <div
          class="rounded border border-dashed border-stone-300 p-6 text-center text-stone-600"
          data-testid="tab-editor-empty"
        >
          <p>No notes yet.</p>
          @if (!readonly()) {
            <button
              type="button"
              class="mt-3 rounded bg-brand-700 px-3 py-1.5 text-sm text-white"
              (click)="addColumn()"
              data-testid="add-column"
            >
              Add first note
            </button>
          }
        </div>
      } @else {
        <div
          class="overflow-x-auto rounded border border-stone-200 bg-white p-3"
          role="group"
          aria-label="Tablature"
        >
          <table class="border-collapse font-mono text-sm">
            <thead>
              @if (readonly() && columnChords().length) {
                <tr data-testid="tab-chords">
                  <th scope="col" class="sr-only">Chord</th>
                  @for (order of columns(); track order; let col = $index) {
                    <th
                      scope="col"
                      class="px-0.5 text-left font-sans text-xs font-semibold text-stone-700"
                      [attr.data-testid]="'tab-chord-' + col"
                    >
                      @if (chordChangesAt(col); as chord) {
                        {{ chord }}
                      }
                    </th>
                  }
                </tr>
              }
              <tr>
                <th scope="col" class="sr-only">String</th>
                @for (order of columns(); track order; let col = $index) {
                  <th scope="col" class="px-0.5 pb-1">
                    @if (readonly()) {
                      <span class="text-xs text-stone-500">{{ col + 1 }}</span>
                    } @else {
                      <button
                        type="button"
                        class="w-9 rounded text-xs"
                        [class]="
                          selectedColumn() === order
                            ? 'bg-brand-700 text-white'
                            : 'text-stone-600 hover:bg-stone-100'
                        "
                        [attr.aria-pressed]="selectedColumn() === order"
                        [attr.aria-label]="'Select position ' + (col + 1)"
                        [attr.data-testid]="'column-' + col"
                        (click)="selectedColumn.set(order)"
                      >
                        {{ col + 1 }}
                      </button>
                    }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (s of strings(); track s) {
                <tr>
                  <th
                    scope="row"
                    class="pr-2 text-right text-xs font-normal text-stone-500"
                  >
                    {{ stringLabels()[s] ?? s + 1 }}
                  </th>
                  @for (order of columns(); track order; let col = $index) {
                    @let e = cell(order, s);
                    <td class="border-y border-stone-300 px-0.5 py-0.5">
                      @if (readonly()) {
                        <span
                          class="inline-flex w-9 flex-col items-center rounded"
                          [class.bg-amber-100]="!!e && highlighted().has(e.id)"
                          [class.ring-2]="!!e && highlighted().has(e.id)"
                          [class.ring-amber-500]="
                            !!e && highlighted().has(e.id)
                          "
                          [attr.data-highlighted]="
                            e && highlighted().has(e.id) ? 'true' : null
                          "
                        >
                          <span [attr.data-testid]="'cell-' + col + '-' + s">{{
                            cellText(e)
                          }}</span>
                          @if (e && roleLabel(e.id); as label) {
                            <span
                              class="font-sans text-[10px] leading-none"
                              [class]="
                                roles()[e.id]?.note?.chordTone
                                  ? 'font-semibold text-brand-700'
                                  : 'text-stone-500'
                              "
                              [attr.data-testid]="'cell-role-' + col + '-' + s"
                              >{{ label }}</span
                            >
                          }
                        </span>
                      } @else {
                        <input
                          type="text"
                          inputmode="numeric"
                          maxlength="2"
                          class="w-9 rounded border px-1 py-0.5 text-center"
                          [class]="cellClass(e)"
                          [value]="cellText(e)"
                          [attr.aria-label]="
                            'String ' + (s + 1) + ', position ' + (col + 1)
                          "
                          [attr.aria-invalid]="
                            e && issueIds().has(e.id) ? true : null
                          "
                          [attr.data-testid]="'cell-' + col + '-' + s"
                          [attr.data-review]="
                            e && needsReview(e) ? 'true' : null
                          "
                          [title]="e ? cellTitle(e) : ''"
                          (focus)="selectedColumn.set(order)"
                          (change)="onCell(order, s, $any($event.target))"
                        />
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (readonly() && hasRoles()) {
          <p class="text-xs text-stone-600" data-testid="tab-role-legend">
            Under each fret: its role over the chord (<span
              class="font-semibold text-brand-700"
              >bold</span
            >
            = chord tone).
          </p>
        }
        @if (!readonly() && selected(); as sel) {
          <section
            class="rounded border border-stone-200 bg-stone-50 p-3"
            aria-label="Selected position"
            data-testid="column-panel"
          >
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="font-medium">Position {{ sel.index + 1 }}</span>
              <button
                type="button"
                class="btn-ghost"
                (click)="insert(sel.order)"
                data-testid="insert-before"
              >
                Insert before
              </button>
              <button
                type="button"
                class="btn-ghost"
                (click)="insert(sel.order + 1)"
                data-testid="insert-after"
              >
                Insert after
              </button>
              <button
                type="button"
                class="btn-ghost"
                [disabled]="sel.index === 0"
                (click)="move(sel.order, -1)"
                data-testid="move-left"
              >
                Move left
              </button>
              <button
                type="button"
                class="btn-ghost"
                [disabled]="sel.index === columns().length - 1"
                (click)="move(sel.order, 1)"
                data-testid="move-right"
              >
                Move right
              </button>
              <button
                type="button"
                class="btn-ghost text-red-700"
                (click)="remove(sel.order)"
                data-testid="delete-column"
              >
                Delete position
              </button>
            </div>
            @if (sel.events.length === 0) {
              <p class="mt-2 text-sm text-stone-600">
                Type a fret number in this column to add a note.
              </p>
            }
            @for (e of sel.events; track e.id) {
              <fieldset
                class="mt-3 rounded border border-stone-200 bg-white p-2 text-sm"
                [attr.data-testid]="'note-panel-' + e.stringIndex"
              >
                <legend class="px-1 font-medium">
                  String {{ e.stringIndex + 1 }}: {{ cellText(e) }}
                </legend>
                <div class="flex flex-wrap gap-x-3 gap-y-1">
                  @for (t of techniqueOptions; track t.value) {
                    <label class="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        [checked]="e.techniques.includes(t.value)"
                        (change)="
                          toggleTechnique(
                            e,
                            t.value,
                            $any($event.target).checked
                          )
                        "
                      />
                      {{ t.label }}
                    </label>
                  }
                </div>
                <div class="mt-2 flex flex-wrap gap-4">
                  @if (
                    e.techniques.includes('bend') ||
                    e.techniques.includes('pre-bend')
                  ) {
                    <label class="inline-flex items-center gap-2">
                      Bend
                      <select
                        class="rounded border px-1 py-0.5"
                        (change)="setBend(e, $any($event.target).value)"
                        [attr.data-testid]="'bend-' + e.stringIndex"
                      >
                        <option
                          value=""
                          [selected]="e.bendSemitones === undefined"
                        >
                          Choose…
                        </option>
                        @for (b of bendOptions; track b.value) {
                          <option
                            [value]="b.value"
                            [selected]="e.bendSemitones === b.value"
                          >
                            {{ b.label }}
                          </option>
                        }
                      </select>
                    </label>
                  }
                  <label class="inline-flex items-center gap-2">
                    Duration
                    <select
                      class="rounded border px-1 py-0.5 disabled:bg-stone-100"
                      [disabled]="!rhythmKnown()"
                      (change)="setDuration(e, $any($event.target).value)"
                      [attr.data-testid]="'duration-' + e.stringIndex"
                    >
                      <option value="" [selected]="e.durationTicks === null">
                        {{ rhythmKnown() ? 'Choose…' : 'Unknown' }}
                      </option>
                      @for (d of durationOptions; track d.value) {
                        <option
                          [value]="d.value"
                          [selected]="e.durationTicks === d.value"
                        >
                          {{ d.label }}
                        </option>
                      }
                    </select>
                  </label>
                </div>
                @for (msg of issuesFor(e.id); track msg) {
                  <p class="mt-1 text-red-700" role="alert">{{ msg }}</p>
                }
              </fieldset>
            }
          </section>
        }

        @if (!readonly()) {
          <button
            type="button"
            class="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
            (click)="addColumn()"
            data-testid="add-column"
          >
            Add position at end
          </button>
        }
      }
    </div>
  `,
  styles: `
    .btn-ghost {
      border-radius: 0.25rem;
      border: 1px solid var(--color-stone-300);
      padding: 0.125rem 0.5rem;
      background: white;
    }
    .btn-ghost:disabled {
      opacity: 0.5;
    }
  `,
})
export class TabEditorComponent {
  readonly events = model.required<EditorEvent[]>();
  readonly rhythmKnown = model(false);
  readonly stringCount = input(6);
  /** Labels per string index, e.g. open-string note names. */
  readonly stringLabels = input<string[]>([]);
  readonly uncertainEventIds = input<string[]>([]);
  readonly issues = input<EventIssue[]>([]);
  readonly readonly = input(false);
  /** Read-only display: each note's role over its chord, by event id. */
  readonly roles = input<Readonly<Record<string, NoteRoles>>>({});
  /** Read-only display: chord in effect at each column; shown where it changes. */
  readonly columnChords = input<readonly (string | null)[]>([]);
  /** Read-only display: notes to highlight (e.g. cited by an explanation). */
  readonly highlightIds = input<readonly string[]>([]);
  protected readonly highlighted = computed(() => new Set(this.highlightIds()));
  protected readonly hasRoles = computed(() =>
    Object.values(this.roles()).some((r) => r.note),
  );

  protected chordChangesAt(col: number): string | null {
    const chords = this.columnChords();
    const chord = chords[col] ?? null;
    return chord && (col === 0 || chords[col - 1] !== chord) ? chord : null;
  }

  protected roleLabel(id: string): string | null {
    return formatRoles(this.roles()[id]);
  }

  protected readonly selectedColumn = signal<number | null>(null);
  protected readonly techniqueOptions = TECHNIQUE_OPTIONS;
  protected readonly bendOptions = BEND_OPTIONS;
  protected readonly durationOptions = DURATION_OPTIONS;
  protected readonly cellText = cellText;

  protected readonly strings = computed(() =>
    Array.from({ length: this.stringCount() }, (_, i) => i),
  );
  /** Columns include orders with events plus an explicitly inserted empty one. */
  private readonly pendingEmpty = signal<number | null>(null);
  protected readonly columns = computed(() => {
    const orders = sliceOrders(this.events());
    const pending = this.pendingEmpty();
    return pending !== null && !orders.includes(pending)
      ? [...orders, pending].sort((a, b) => a - b)
      : orders;
  });
  private readonly byCell = computed(
    () => new Map(this.events().map((e) => [`${e.order}:${e.stringIndex}`, e])),
  );
  protected readonly issueIds = computed(
    () => new Set(this.issues().flatMap((i) => (i.eventId ? [i.eventId] : []))),
  );
  private readonly uncertainSet = computed(
    () => new Set(this.uncertainEventIds()),
  );

  protected readonly selected = computed(() => {
    const order = this.selectedColumn();
    const index = order === null ? -1 : this.columns().indexOf(order);
    if (order === null || index < 0) return null;
    return {
      order,
      index,
      events: this.events()
        .filter((e) => e.order === order)
        .sort((a, b) => a.stringIndex - b.stringIndex),
    };
  });

  protected cell(order: number, stringIndex: number): EditorEvent | undefined {
    return this.byCell().get(`${order}:${stringIndex}`);
  }

  protected needsReview(e: EditorEvent): boolean {
    return (
      (e.confidence !== undefined && e.confidence < LOW_CONFIDENCE) ||
      this.uncertainSet().has(e.id)
    );
  }

  protected cellClass(e: EditorEvent | undefined): string {
    if (!e) return 'border-transparent bg-transparent hover:border-stone-300';
    if (this.issueIds().has(e.id))
      return 'border-red-500 bg-red-100 ring-2 ring-red-500';
    if (this.needsReview(e)) return 'border-amber-400 bg-amber-200';
    return 'border-stone-300 bg-white';
  }

  protected cellTitle(e: EditorEvent): string {
    const parts: string[] = [];
    if (e.confidence !== undefined)
      parts.push(`Confidence ${Math.round(e.confidence * 100)}%`);
    parts.push(...this.issuesFor(e.id));
    return parts.join(' · ');
  }

  protected issuesFor(id: string): string[] {
    return this.issues()
      .filter((i) => i.eventId === id)
      .map((i) => i.message);
  }

  protected onCell(
    order: number,
    stringIndex: number,
    target: HTMLInputElement,
  ): void {
    const parsed = parseCell(target.value);
    const make = (id: string): EditorEvent => ({
      id,
      order,
      stringIndex,
      fret: null,
      durationTicks: null,
      techniques: [],
    });
    const existing = this.cell(order, stringIndex);
    switch (parsed.kind) {
      case 'invalid':
        target.value = cellText(existing);
        return;
      case 'clear':
        this.events.set(
          setNote(this.events(), order, stringIndex, undefined, make),
        );
        return;
      case 'dead': {
        const next = setNote(this.events(), order, stringIndex, null, make);
        this.events.set(
          next.map((e) =>
            e.order === order && e.stringIndex === stringIndex
              ? withTechnique(e, 'dead-note', true)
              : e,
          ),
        );
        return;
      }
      case 'fret': {
        const next = setNote(
          this.events(),
          order,
          stringIndex,
          parsed.fret,
          make,
        );
        this.events.set(
          next.map((e) =>
            e.order === order && e.stringIndex === stringIndex
              ? withTechnique(e, 'dead-note', false)
              : e,
          ),
        );
        if (this.pendingEmpty() === order) this.pendingEmpty.set(null);
      }
    }
  }

  protected toggleTechnique(e: EditorEvent, t: Technique, on: boolean): void {
    let updated = withTechnique(e, t, on);
    if (t === 'dead-note')
      updated = { ...updated, fret: on ? null : (e.fret ?? 0) };
    if (
      (t === 'bend' || t === 'pre-bend') &&
      !on &&
      !updated.techniques.some((x) => x === 'bend' || x === 'pre-bend')
    ) {
      updated = { ...updated, bendSemitones: undefined };
    }
    this.events.set(updateEvent(this.events(), e.id, updated));
  }

  protected setBend(e: EditorEvent, value: string): void {
    this.events.set(
      updateEvent(this.events(), e.id, {
        bendSemitones: value === '' ? undefined : Number(value),
      }),
    );
  }

  protected setDuration(e: EditorEvent, value: string): void {
    this.events.set(
      updateEvent(this.events(), e.id, {
        durationTicks: value === '' ? null : Number(value),
      }),
    );
  }

  protected toggleRhythm(known: boolean): void {
    this.rhythmKnown.set(known);
    if (!known)
      this.events.set(
        this.events().map((e) => ({ ...e, durationTicks: null })),
      );
  }

  protected insert(atOrder: number): void {
    this.events.set(insertSliceBefore(this.events(), atOrder));
    this.pendingEmpty.set(atOrder);
    this.selectedColumn.set(atOrder);
  }

  protected addColumn(): void {
    const cols = this.columns();
    const next = cols.length ? cols[cols.length - 1] + 1 : 0;
    this.pendingEmpty.set(next);
    this.selectedColumn.set(next);
  }

  protected move(order: number, direction: -1 | 1): void {
    const cols = this.columns();
    const target = cols[cols.indexOf(order) + direction];
    this.events.set(moveSlice(this.events(), order, direction));
    if (target !== undefined) this.selectedColumn.set(target);
  }

  protected remove(order: number): void {
    this.events.set(deleteSlice(this.events(), order));
    if (this.pendingEmpty() === order) this.pendingEmpty.set(null);
    this.selectedColumn.set(null);
  }
}

function withTechnique(e: EditorEvent, t: Technique, on: boolean): EditorEvent {
  const has = e.techniques.includes(t);
  if (on === has) return e;
  return {
    ...e,
    techniques: on ? [...e.techniques, t] : e.techniques.filter((x) => x !== t),
  };
}
