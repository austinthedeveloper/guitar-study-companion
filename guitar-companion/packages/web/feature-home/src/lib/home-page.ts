import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HealthApi } from '@gsc/web/data-access';
import { RouterLink } from '@angular/router';
import {
  analyzeNotes,
  harmonize,
  parseKey,
  sliceOrders,
  STANDARD_TUNING_MIDI,
} from '@gsc/music-domain';
import {
  ApiStatusComponent,
  ApiStatusView,
  EditorEvent,
  tabAnnotations,
  TabEditorComponent,
} from '@gsc/web/ui';

@Component({
  selector: 'gsc-home-page',
  imports: [ApiStatusComponent, RouterLink, TabEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-wrap items-center gap-x-12 gap-y-8 py-4">
      <div class="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
        <h1
          class="font-display text-[34px] leading-[40px] font-[560] tracking-[-0.01em] text-ink sm:text-[44px] sm:leading-[50px]"
        >
          Learn from music, not just learn to play music.
        </h1>
        <p class="max-w-xl text-lg leading-7 text-ink-muted">
          Turn passages from your guitar books into vocabulary you can
          understand, practice, and use in your own playing.
        </p>
        <div class="flex flex-wrap gap-3 pt-1">
          <a routerLink="/import" class="btn-primary" data-testid="cta-import"
            >Import a passage</a
          >
          <a
            routerLink="/phrases"
            class="btn-secondary"
            data-testid="cta-phrases"
            >My phrases</a
          >
        </div>
      </div>
      <figure
        class="m-0 flex min-w-0 flex-[1_1_380px] flex-col gap-3 rounded-[10px] border border-rule bg-paper-raised p-5"
        data-testid="home-example"
      >
        <gsc-tab-editor
          class="block [&_[role=group]]:border-0 [&_[role=group]]:p-0"
          [events]="example.events"
          [readonly]="true"
          [stringLabels]="['E', 'B', 'G', 'D', 'A', 'E']"
          [roles]="example.roles"
          [columnChords]="example.columnChords"
          [annotations]="example.annotations"
        />
        <figcaption class="text-sm text-ink-muted">
          An example: every phrase you import is read back as notes, with each
          note's role in the chord, so you can see why it sounds the way it
          does.
        </figcaption>
      </figure>
    </section>
    <div class="mt-10 max-w-md">
      <gsc-api-status [status]="status()" />
    </div>
  `,
})
export class HomePage {
  /** A short A minor pentatonic run over Am7, analysed like a saved phrase. */
  protected readonly example = buildExample();

  private readonly api = inject(HealthApi);
  private readonly health = rxResource({ stream: () => this.api.getHealth() });

  protected readonly status = computed<ApiStatusView>(() => {
    if (this.health.error())
      return {
        state: 'error',
        message: 'Could not reach the API. Try again shortly.',
      };
    const h = this.health.value();
    if (!h) return { state: 'loading' };
    return {
      state: h.status,
      version: h.version,
      database: h.checks.database,
      aiProvider: h.checks.aiProvider,
    };
  });
}

function buildExample() {
  const frets: [number, number][] = [
    [1, 8],
    [1, 5],
    [2, 7],
    [2, 5],
    [3, 7],
    [3, 5],
    [4, 7],
    [3, 7],
  ];
  const events: EditorEvent[] = frets.map(([stringIndex, fret], i) => ({
    id: `x${i}`,
    order: i,
    stringIndex,
    fret,
    durationTicks: null,
    techniques: [],
  }));
  const analysis = analyzeNotes({
    events,
    tuningMidi: STANDARD_TUNING_MIDI,
    capo: 0,
    key: parseKey('A minor'),
  });
  const harmony = harmonize({ analysis, chords: 'Am7' });
  return {
    events,
    roles: harmony.roles,
    columnChords: harmony.columnChords,
    annotations: tabAnnotations(sliceOrders(events), analysis, harmony.roles),
  };
}
