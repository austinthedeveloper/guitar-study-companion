import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ChordChange, Exercise, Phrase, TabEvent } from '@gsc/contracts';
import {
  analyzeNotes,
  applyOverProgression,
  alternateEnding,
  formatKey,
  formatRoles,
  harmonize,
  holdTargets,
  midiToNoteName,
  NoteAnalysis,
  NoteRoles,
  parseChord,
  parseKey,
  transposeChord,
  transposePhrase,
  transposeProgression,
  transposeSemitones,
  validateTransposition,
  Variation,
  VariationResult,
} from '@gsc/music-domain';
import { phraseNoteEvents } from '@gsc/web/audio';
import {
  ExercisePlayback,
  Flash,
  PhrasesApi,
  toClientError,
} from '@gsc/web/data-access';
import {
  AlertComponent,
  CompareRow,
  ExerciseCardComponent,
  OctaveChoice,
  TabEditorComponent,
  TransposeCompareComponent,
  TransposeFormComponent,
} from '@gsc/web/ui';
import { firstValueFrom } from 'rxjs';

/** A phrase version shown on the page: original, transposed, or a variation. */
interface Version {
  events: TabEvent[];
  analysis: NoteAnalysis;
  rhythmKnown: boolean;
}

@Component({
  selector: 'gsc-transpose-page',
  imports: [
    AlertComponent,
    ExerciseCardComponent,
    RouterLink,
    TabEditorComponent,
    TransposeCompareComponent,
    TransposeFormComponent,
  ],
  providers: [ExercisePlayback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (phrase.isLoading()) {
      <p class="text-stone-600" role="status">Loading…</p>
    } @else if (phraseError(); as err) {
      @if (err.code === 'not_found') {
        <section class="py-12 text-center" data-testid="transpose-not-found">
          <h1 class="text-2xl font-semibold">Phrase not found</h1>
          <a
            routerLink="/phrases"
            class="mt-4 inline-block text-brand-700 underline"
            >Back to my phrases</a
          >
        </section>
      } @else {
        <gsc-alert kind="error" heading="Could not load this phrase">
          <p>{{ err.message }}</p>
        </gsc-alert>
      }
    } @else if (phrase.value(); as p) {
      <article class="space-y-5" data-testid="transpose">
        <header>
          <a
            [routerLink]="['/phrases', p.id]"
            class="text-sm text-brand-700 underline"
            >← {{ p.title }}</a
          >
          <h1 class="mt-1 text-2xl font-semibold">Transpose and vary</h1>
          <p class="text-sm text-stone-600">
            Every note moves by the same interval, so the lick's shape and each
            note's role are kept. Fingerings are worked out to stay playable.
          </p>
        </header>

        <gsc-transpose-form
          [(fromKey)]="fromKey"
          [(toKey)]="toKey"
          [(octave)]="octave"
          [(position)]="position"
          [(maxFret)]="maxFret"
        />

        @if (keyProblem(); as problem) {
          <p class="text-sm text-stone-600" data-testid="transpose-hint">
            {{ problem }}
          </p>
        } @else if (result()?.problem; as problem) {
          <gsc-alert
            kind="warning"
            heading="No playable fingering"
            data-testid="transpose-problem"
          >
            <p>{{ problem }}</p>
          </gsc-alert>
        } @else if (transposed(); as t) {
          @if (issues().length) {
            <gsc-alert
              kind="error"
              heading="This fingering failed its checks"
              data-testid="transpose-issues"
            >
              <ul class="list-disc pl-5">
                @for (i of issues(); track $index) {
                  <li>{{ i }}</li>
                }
              </ul>
            </gsc-alert>
          }
          <section class="space-y-3" aria-labelledby="transposed-heading">
            <div class="flex flex-wrap items-center gap-3">
              <h2
                id="transposed-heading"
                class="text-lg font-semibold"
                data-testid="transposed-heading"
              >
                In {{ toLabel() }} ({{ shiftLabel() }})
              </h2>
              <button
                type="button"
                class="btn-secondary"
                (click)="playVersion('original', original())"
                data-testid="play-original"
              >
                Play original
              </button>
              <button
                type="button"
                class="btn-secondary"
                (click)="playVersion('transposed', t)"
                data-testid="play-transposed"
              >
                Play transposed
              </button>
              <button
                type="button"
                class="btn-primary"
                [disabled]="saving() || issues().length > 0"
                (click)="save(p, t, 'Transposed to ' + toLabel(), '')"
                data-testid="save-transposed"
              >
                Save as new phrase
              </button>
            </div>
            <gsc-tab-editor
              class="block"
              data-testid="transposed-tab"
              [events]="t.events"
              [rhythmKnown]="p.rhythmKnown"
              [stringCount]="p.context.tuningMidi.length"
              [stringLabels]="stringLabels()"
              [readonly]="true"
              [roles]="harmonyAfter().roles"
              [columnChords]="harmonyAfter().columnChords"
            />
            <gsc-transpose-compare
              [rows]="compareRows()"
              [beforeLabel]="'In ' + fromLabel()"
              [afterLabel]="'In ' + toLabel()"
            />
            @if (saveError(); as err) {
              <gsc-alert kind="error" heading="Could not save">
                <p>{{ err }}</p>
              </gsc-alert>
            }
          </section>

          <section class="space-y-3" aria-labelledby="variations-heading">
            <h2 id="variations-heading" class="text-lg font-semibold">
              Variations
            </h2>
            @for (v of variations(); track $index) {
              @if (v.variation; as variation) {
                <div class="space-y-2" data-testid="variation">
                  <gsc-exercise-card
                    [exercise]="asExercise(variation, 'v' + $index)"
                    [number]="$index + 1"
                    [tabEvents]="$any(variation.events)"
                    [stringCount]="p.context.tuningMidi.length"
                    [stringLabels]="stringLabels()"
                    [bpm]="playback.bpmOf(asExercise(variation, 'v' + $index))"
                    [playing]="playback.playingId() === 'v' + $index"
                    [metronomeOn]="playback.metronomeId() === 'v' + $index"
                    [beat]="playback.beat()"
                    [trackable]="false"
                    label="Variation"
                    [highlightIds]="highlightsOf(variation)"
                    (playExercise)="playVariation('v' + $index, variation)"
                    (stopPlayback)="playback.stop()"
                    (toggleMetronome)="
                      playback.toggleMetronome(
                        asExercise(variation, 'v' + $index)
                      )
                    "
                    (tempoChange)="
                      playback.setTempo(
                        asExercise(variation, 'v' + $index),
                        $event
                      )
                    "
                    (downloadMidi)="noop()"
                  />
                  <button
                    type="button"
                    class="btn-secondary"
                    [disabled]="saving()"
                    (click)="saveVariation(p, variation)"
                    data-testid="save-variation"
                  >
                    Save this variation as a phrase
                  </button>
                </div>
              } @else {
                <p
                  class="text-sm text-stone-600"
                  data-testid="variation-skipped"
                >
                  {{ v.reason }}
                </p>
              }
            }
          </section>

          <section class="space-y-3" aria-labelledby="apply-heading">
            <h2 id="apply-heading" class="text-lg font-semibold">
              Apply over a progression
            </h2>
            <label class="block text-sm">
              <span class="block text-stone-700"
                >Chords (in {{ toLabel() }})</span
              >
              <input
                class="mt-1 w-full rounded border border-stone-300 px-2 py-1"
                autocomplete="off"
                placeholder="e.g. C7 F7 G7"
                [value]="progression()"
                (input)="progression.set($any($event.target).value)"
                data-testid="apply-progression"
              />
            </label>
            <p class="text-sm text-stone-600">
              Play the phrase once over each chord, ending on that chord's root
              (or 3rd). The count shows how many notes are chord tones.
            </p>
            @for (a of applications(); track $index) {
              <div data-testid="application">
                @if (!a.understood) {
                  <p class="text-sm text-amber-800">{{ a.ending.reason }}</p>
                } @else {
                  <p class="text-sm font-medium" data-testid="application-fit">
                    Over {{ a.chord }}: {{ a.chordTones }} of
                    {{ a.pitchedNotes }}
                    notes are chord tones.
                  </p>
                  @if (a.ending.variation; as ending) {
                    <gsc-exercise-card
                      [exercise]="asExercise(ending, 'a' + $index, a.chord)"
                      [number]="$index + 1"
                      [tabEvents]="$any(ending.events)"
                      [stringCount]="p.context.tuningMidi.length"
                      [stringLabels]="stringLabels()"
                      [bpm]="
                        playback.bpmOf(
                          asExercise(ending, 'a' + $index, a.chord)
                        )
                      "
                      [playing]="playback.playingId() === 'a' + $index"
                      [metronomeOn]="playback.metronomeId() === 'a' + $index"
                      [beat]="playback.beat()"
                      [trackable]="false"
                      label="Over the chords"
                      [highlightIds]="ending.changedEventIds"
                      (playExercise)="playVariation('a' + $index, ending)"
                      (stopPlayback)="playback.stop()"
                      (toggleMetronome)="
                        playback.toggleMetronome(
                          asExercise(ending, 'a' + $index, a.chord)
                        )
                      "
                      (tempoChange)="
                        playback.setTempo(
                          asExercise(ending, 'a' + $index, a.chord),
                          $event
                        )
                      "
                      (downloadMidi)="noop()"
                    />
                  } @else {
                    <p class="text-sm text-stone-600">{{ a.ending.reason }}</p>
                  }
                }
              </div>
            }
          </section>
        }
      </article>
    }
  `,
})
export class TransposePage {
  /** Phrase id, bound from the route. */
  readonly id = input.required<string>();
  private readonly api = inject(PhrasesApi);
  private readonly router = inject(Router);
  private readonly flash = inject(Flash);
  protected readonly playback = inject(ExercisePlayback);

  protected readonly phrase = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.get(params),
  });
  protected readonly phraseError = computed(() =>
    this.phrase.error() ? toClientError(this.phrase.error()) : null,
  );
  private readonly loaded = computed(() =>
    this.phrase.hasValue() ? this.phrase.value() : undefined,
  );

  protected readonly fromKey = signal('');
  protected readonly toKey = signal('');
  protected readonly octave = signal<OctaveChoice>('nearest');
  protected readonly position = signal<number | null>(null);
  protected readonly maxFret = signal(22);
  protected readonly progression = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  private readonly from = computed(() => parseKey(this.fromKey()));
  private readonly to = computed(() => parseKey(this.toKey()));
  protected readonly fromLabel = computed(() => {
    const k = this.from();
    return k ? formatKey(k) : this.fromKey();
  });
  protected readonly toLabel = computed(() => {
    const k = this.to();
    return k ? formatKey(k) : this.toKey();
  });
  protected readonly keyProblem = computed(() => {
    if (!this.from())
      return this.fromKey().trim()
        ? `"${this.fromKey()}" isn't a key this app understands. Try A, F#m, or Bb.`
        : "Enter the phrase's key, then the key to move it to.";
    if (!this.to())
      return this.toKey().trim()
        ? `"${this.toKey()}" isn't a key this app understands.`
        : 'Enter the key to move it to.';
    return null;
  });
  protected readonly semitones = computed(() => {
    const from = this.from();
    const to = this.to();
    return from && to ? transposeSemitones(from, to, this.octave()) : null;
  });
  protected readonly shiftLabel = computed(() => {
    const s = this.semitones() ?? 0;
    return s === 0
      ? 'same pitch'
      : `${s > 0 ? 'up' : 'down'} ${Math.abs(s)} semitone${Math.abs(s) === 1 ? '' : 's'}`;
  });

  protected readonly original = computed<Version>(() => {
    const p = this.loaded();
    return {
      events: p?.events ?? [],
      rhythmKnown: p?.rhythmKnown ?? false,
      analysis: analyzeNotes({
        events: p?.events ?? [],
        tuningMidi: p?.context.tuningMidi ?? [],
        capo: p?.context.capo ?? 0,
        key: this.from(),
      }),
    };
  });
  protected readonly result = computed(() => {
    const p = this.loaded();
    const s = this.semitones();
    if (!p || s === null) return null;
    return transposePhrase(p.events, this.original().analysis, s, {
      tuningMidi: p.context.tuningMidi,
      capo: p.context.capo,
      maxFret: this.maxFret(),
      position: this.position(),
    });
  });
  protected readonly transposed = computed<Version | null>(() => {
    const p = this.loaded();
    const events = this.result()?.events;
    if (!p || !events) return null;
    return {
      events: events as TabEvent[],
      rhythmKnown: p.rhythmKnown,
      analysis: analyzeNotes({
        events,
        tuningMidi: p.context.tuningMidi,
        capo: p.context.capo,
        key: this.to(),
      }),
    };
  });

  /** The phrase's chords and placement moved to the new key. */
  private readonly chordsAfter = computed(() => {
    const ctx = this.loaded()?.context;
    const s = this.semitones() ?? 0;
    return {
      chords: transposeProgression(ctx?.chords, s, this.to()),
      changes: (ctx?.chordChanges ?? []).map((c) => ({
        ...c,
        chord: transposeChord(c.chord, s, this.to()).symbol,
      })),
    };
  });
  private readonly harmonyBefore = computed(() =>
    harmonize({
      analysis: this.original().analysis,
      chords: this.loaded()?.context.chords,
      chordChanges: this.loaded()?.context.chordChanges,
    }),
  );
  protected readonly harmonyAfter = computed(() =>
    harmonize({
      analysis: this.transposed()?.analysis ?? this.original().analysis,
      chords: this.chordsAfter().chords,
      chordChanges: this.chordsAfter().changes,
    }),
  );

  /** Independent checks, including that every note kept its role. */
  protected readonly issues = computed(() => {
    const p = this.loaded();
    const t = this.transposed();
    const s = this.semitones();
    if (!p || !t || s === null) return [];
    const found = validateTransposition({
      original: p.events,
      transposed: t.events,
      semitones: s,
      tuningMidi: p.context.tuningMidi,
      capo: p.context.capo,
      maxFret: this.maxFret(),
    }).map((i) => i.message);
    for (const e of p.events) {
      const before = formatRoles(this.harmonyBefore().roles[e.id]);
      const after = formatRoles(this.harmonyAfter().roles[e.id]);
      if (before !== after)
        found.push(
          `A note changed role (${before ?? 'none'} → ${after ?? 'none'}).`,
        );
    }
    return found;
  });

  protected readonly compareRows = computed<CompareRow[]>(() => {
    const before = this.original().analysis.columns;
    const after = this.transposed()?.analysis.columns ?? [];
    const label = (
      notes: {
        eventId: string;
        name: string | null;
        bendToName?: string;
        dead: boolean;
      }[],
    ) =>
      notes
        .map((n) =>
          n.dead
            ? 'x'
            : n.bendToName
              ? `${n.name}→${n.bendToName}`
              : (n.name ?? '?'),
        )
        .join(' + ');
    const roles = (
      notes: { eventId: string }[],
      harmony: { roles: Readonly<Record<string, NoteRoles>> },
    ) =>
      notes
        .map((n) => formatRoles(harmony.roles[n.eventId]))
        .filter(Boolean)
        .join(' + ');
    return before.map((c, i) => ({
      step: i + 1,
      before: {
        notes: label(c.notes),
        roles: roles(c.notes, this.harmonyBefore()),
        chord: this.harmonyBefore().columnChords[i],
      },
      after: {
        notes: label(after[i]?.notes ?? []),
        roles: roles(after[i]?.notes ?? [], this.harmonyAfter()),
        chord: this.harmonyAfter().columnChords[i],
      },
    }));
  });

  private readonly base = computed(() => {
    const p = this.loaded();
    const t = this.transposed();
    return {
      events: t?.events ?? [],
      analysis: t?.analysis ?? this.original().analysis,
      tuningMidi: p?.context.tuningMidi ?? [],
      capo: p?.context.capo ?? 0,
      key: this.to(),
      maxFret: this.maxFret(),
    };
  });
  protected readonly variations = computed<VariationResult[]>(() => {
    const h = this.harmonyAfter();
    const lastChord = [...h.columnChords].reverse().find((c) => c) ?? null;
    return [
      holdTargets({
        ...this.base(),
        roles: h.roles,
        columnChords: h.columnChords,
      }),
      alternateEnding({
        ...this.base(),
        chord: lastChord ? parseChord(lastChord) : null,
      }),
    ];
  });
  protected readonly applications = computed(() =>
    this.progression().trim()
      ? applyOverProgression({
          ...this.base(),
          progression: this.progression(),
        })
      : [],
  );

  protected readonly stringLabels = computed(() =>
    (this.loaded()?.context.tuningMidi ?? []).map((m) =>
      midiToNoteName(m).replace(/-?\d+$/, ''),
    ),
  );

  constructor() {
    // Start from the phrase's own key and chords.
    effect(() => {
      const p = this.loaded();
      if (!p) return;
      this.fromKey.set(p.context.key ?? '');
    });
    effect(() => {
      const chords = this.chordsAfter().chords;
      if (this.semitones() !== null) this.progression.set(chords ?? '');
    });
  }

  /** Exercise-card view of a variation or application ending. */
  protected asExercise(v: Variation, id: string, chord?: string): Exercise {
    return {
      id,
      kind: chord ? 'apply' : 'slow',
      title: chord
        ? `Over ${chord}: ${v.title.charAt(0).toLowerCase()}${v.title.slice(1)}`
        : v.title,
      objective: v.description,
      eventIds: v.events.map((e) => e.id),
      referenceNotes: [],
      ...(chord ? { chord } : {}),
      tempo: {
        startBpm: 60,
        targetBpm: 100,
        stepBpm: 5,
        rhythmic: v.rhythmKnown,
      },
      repetitions: 4,
      successCriterion: chord
        ? `The ending lands cleanly over ${chord}, 3 times in a row.`
        : 'Played cleanly 3 times in a row.',
      instructions: [],
      coaching: [],
      minutes: 2,
    };
  }

  /** A rhythm variation changes every note's length; only endings are worth marking. */
  protected highlightsOf(v: Variation): string[] {
    return v.kind === 'ending' ? v.changedEventIds : [];
  }

  protected noop(): void {
    // MIDI export lives on the practice page; variations play in place.
  }

  protected playVersion(id: string, v: Version): void {
    this.playback.play(
      id,
      phraseNoteEvents(
        v.analysis,
        new Map(v.events.map((e) => [e.id, e.durationTicks])),
        {
          bpm: 80,
          rhythmic: v.rhythmKnown,
        },
      ),
    );
  }

  protected playVariation(id: string, v: Variation): void {
    const p = this.loaded();
    if (!p) return;
    const analysis = analyzeNotes({
      events: v.events,
      tuningMidi: p.context.tuningMidi,
      capo: p.context.capo,
    });
    this.playback.play(
      id,
      phraseNoteEvents(
        analysis,
        new Map(v.events.map((e) => [e.id, e.durationTicks ?? null])),
        {
          bpm: this.playback.bpmOf(this.asExercise(v, id)),
          rhythmic: v.rhythmKnown,
        },
      ),
    );
  }

  protected saveVariation(p: Phrase, v: Variation): void {
    const analysis = analyzeNotes({
      events: v.events,
      tuningMidi: p.context.tuningMidi,
      capo: p.context.capo,
    });
    void this.save(
      p,
      { events: v.events as TabEvent[], analysis, rhythmKnown: v.rhythmKnown },
      `${v.title} (in ${this.toLabel()})`,
      v.description,
    );
  }

  /** Saves a version as a new phrase that records where it came from. */
  protected async save(
    p: Phrase,
    v: Version,
    change: string,
    note: string,
  ): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    const chordChanges: ChordChange[] = this.chordsAfter().changes;
    try {
      const saved = await firstValueFrom(
        this.api.create({
          title:
            `${p.title} (${change.toLowerCase().startsWith('transposed') ? `in ${this.toLabel()}` : change})`.slice(
              0,
              120,
            ),
          source: p.source,
          context: {
            ...p.context,
            key: this.toKey().trim() || undefined,
            chords: this.chordsAfter().chords,
            chordChanges: chordChanges.length ? chordChanges : undefined,
          },
          rhythmKnown: v.rhythmKnown,
          ticksPerQuarter: p.ticksPerQuarter,
          events: v.events.map((e) => ({
            ...e,
            durationTicks: v.rhythmKnown ? (e.durationTicks ?? 480) : null,
          })),
          notes: note || undefined,
          tags: p.tags,
          derivedFrom: {
            phraseId: p.id,
            revision: p.revision,
            semitones: this.semitones() ?? 0,
            change,
          },
        }),
      );
      this.flash.set('phrase-saved');
      await this.router.navigate(['/phrases', saved.id]);
    } catch (err) {
      this.saveError.set(toClientError(err).message);
    } finally {
      this.saving.set(false);
    }
  }
}
