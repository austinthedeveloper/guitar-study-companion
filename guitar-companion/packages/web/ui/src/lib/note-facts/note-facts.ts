import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Interval, NoteAnalysis, NoteFact, NoteRole } from '@gsc/music-domain';

/** A note's role over the chord in effect, and its bend target's. */
export interface NoteRoles {
  note: NoteRole | null;
  bendTo: NoteRole | null;
}

/**
 * Verified note facts computed from the tab: names, chord shapes, and
 * melodic steps, plus each note's role over the user's chord placement.
 * Presentational only; the caller computes roles and owns placement.
 */
@Component({
  selector: 'gsc-note-facts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="space-y-3 rounded-lg border border-stone-300 bg-white p-4"
      aria-labelledby="note-facts-heading"
      data-testid="note-facts"
    >
      <header>
        <h2 id="note-facts-heading" class="text-lg font-semibold">
          Notes and intervals
        </h2>
        <p class="text-sm text-stone-600">
          Computed from your tab, tuning, and capo. {{ spelling() }}
        </p>
      </header>
      @if (analysis().range; as range) {
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt class="text-stone-600">Range</dt>
          <dd data-testid="note-range">
            {{ range.lowest }} – {{ range.highest }}
          </dd>
          <dt class="text-stone-600">Pitches used</dt>
          <dd data-testid="note-pitch-classes">
            {{ analysis().pitchClasses.join(' ') }}
          </dd>
        </dl>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm" data-testid="note-table">
            <thead class="text-stone-600">
              <tr>
                <th scope="col" class="py-1 pr-4 font-medium">#</th>
                @if (chordOptions().length) {
                  <th scope="col" class="py-1 pr-4 font-medium">Chord</th>
                }
                <th scope="col" class="py-1 pr-4 font-medium">Notes</th>
                <th scope="col" class="py-1 font-medium">Interval</th>
              </tr>
            </thead>
            <tbody>
              @for (
                col of analysis().columns;
                track col.order;
                let i = $index
              ) {
                <tr class="border-t border-stone-200" data-testid="note-row">
                  <td class="py-1 pr-4 tabular-nums text-stone-500">
                    {{ i + 1 }}
                  </td>
                  @if (chordOptions().length) {
                    <td class="py-1 pr-4">
                      <select
                        class="rounded border border-stone-300 bg-white px-1 py-0.5"
                        [attr.aria-label]="'Chord from note ' + (i + 1)"
                        (change)="
                          chordChange.emit({
                            order: col.order,
                            chord: $any($event.target).value || null,
                          })
                        "
                        data-testid="chord-select"
                      >
                        <option value="" [selected]="!chordStarts()[col.order]">
                          {{
                            i === 0
                              ? '—'
                              : '↳ ' + (columnChords()[i - 1] ?? '—')
                          }}
                        </option>
                        @for (c of chordOptions(); track c) {
                          <option
                            [value]="c"
                            [selected]="chordStarts()[col.order] === c"
                          >
                            {{ c }}
                          </option>
                        }
                      </select>
                    </td>
                  }
                  <td class="py-1 pr-4" data-testid="note-cell">
                    @for (n of col.notes; track n.eventId; let last = $last) {
                      <span>{{ noteLabel(n) }}</span>
                      @if (roles()[n.eventId]?.note; as r) {
                        <span [class]="roleClass(r)" data-testid="note-role">{{
                          r.label
                        }}</span>
                      }
                      @if (n.bendToName) {
                        <span> → {{ n.bendToName }}</span>
                        @if (roles()[n.eventId]?.bendTo; as r) {
                          <span
                            [class]="roleClass(r)"
                            data-testid="note-role"
                            >{{ r.label }}</span
                          >
                        }
                      }
                      @if (!last) {
                        <span> + </span>
                      }
                    }
                  </td>
                  <td class="py-1">
                    {{ intervalLabel(col.fromPrevious, col.chordIntervals) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-sm text-stone-600">
          No pitched notes (only dead notes).
        </p>
      }
    </section>
  `,
})
export class NoteFactsComponent {
  readonly analysis = input.required<NoteAnalysis>();
  /** e.g. "A minor"; null when no key was given. */
  readonly keyLabel = input<string | null>(null);
  /** The key text as entered, when it could not be understood. */
  readonly unparsedKey = input<string | null>(null);
  /** Role of each note (by event id) over the chord in effect. */
  readonly roles = input<Readonly<Record<string, NoteRoles>>>({});
  /** Chord symbol in effect at each column (same index as analysis columns). */
  readonly columnChords = input<readonly (string | null)[]>([]);
  /** Chords the user can place; when empty, the Chord column is hidden. */
  readonly chordOptions = input<readonly string[]>([]);
  /** Chord placed at a column, by event order. */
  readonly chordStarts = input<Readonly<Record<number, string>>>({});
  /** A chord now starts at this column (or, with null, the previous one continues). */
  readonly chordChange = output<{ order: number; chord: string | null }>();

  protected readonly spelling = computed(() => {
    if (this.keyLabel()) return `Spelled in ${this.keyLabel()}.`;
    if (this.unparsedKey())
      return `Key "${this.unparsedKey()}" was not understood, so notes use sharps.`;
    return 'No key given, so notes use sharps.';
  });

  protected noteLabel(n: NoteFact): string {
    if (n.dead) return 'x';
    return n.name ?? '?';
  }

  protected roleClass(role: NoteRole): string {
    return (
      'ml-1 rounded px-1 text-xs ' +
      (role.chordTone
        ? 'bg-brand-50 font-semibold text-brand-700'
        : 'bg-stone-100 text-stone-600')
    );
  }

  protected intervalLabel(
    fromPrevious: Interval | null,
    chord: readonly Interval[],
  ): string {
    if (chord.length) return `chord: ${chord.map((c) => c.name).join(', ')}`;
    if (!fromPrevious) return '—';
    if (fromPrevious.semitones === 0) return 'same note';
    return `${fromPrevious.name} ${fromPrevious.semitones > 0 ? 'up' : 'down'}`;
  }
}
