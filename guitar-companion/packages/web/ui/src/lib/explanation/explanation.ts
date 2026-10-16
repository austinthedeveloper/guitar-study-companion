import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { Explanation, ExplanationPoint } from '@gsc/contracts';
import { AlertComponent } from '../alert/alert';

/**
 * Shows an AI explanation with observations (cited notes) kept apart from
 * interpretations (stated assumptions). Presentational: the caller decides
 * staleness and performs the request.
 */
@Component({
  selector: 'gsc-explanation',
  imports: [AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="space-y-3 rounded-lg border border-stone-300 bg-white p-4"
      aria-labelledby="explanation-heading"
      data-testid="explanation"
    >
      <header>
        <h2 id="explanation-heading" class="text-lg font-semibold">
          Why it works
        </h2>
        <p class="text-sm text-stone-600">
          Written by AI from the computed notes and your key and chords (no
          image is sent). Check it against the facts above.
        </p>
      </header>

      @if (explanation(); as ex) {
        @if (stale()) {
          <gsc-alert kind="warning" data-testid="explanation-stale"
            >Written for an earlier version of this phrase. Update it to match
            your current key and chords.</gsc-alert
          >
        }
        <p data-testid="explanation-summary">{{ ex.summary }}</p>
        @if (observations().length) {
          <div>
            <h3 class="text-sm font-semibold text-stone-700">In the notes</h3>
            <ul class="mt-1 list-disc space-y-1 pl-5 text-sm">
              @for (p of observations(); track $index) {
                <li data-testid="explanation-observation">
                  {{ p.text }}
                  <span class="text-stone-500">({{ cites(p) }})</span>
                </li>
              }
            </ul>
          </div>
        }
        @if (interpretations().length) {
          <div>
            <h3 class="text-sm font-semibold text-stone-700">Interpretation</h3>
            <ul class="mt-1 list-disc space-y-1 pl-5 text-sm">
              @for (p of interpretations(); track $index) {
                <li data-testid="explanation-interpretation">
                  {{ p.text }}
                  @if (p.eventIds.length) {
                    <span class="text-stone-500">({{ cites(p) }})</span>
                  }
                  @if (p.assumption) {
                    <div class="text-stone-600">
                      Assumes: {{ p.assumption }}
                    </div>
                  }
                </li>
              }
            </ul>
          </div>
        }
        <p class="text-xs text-stone-500" data-testid="explanation-meta">
          {{ ex.provider }} · {{ ex.model }}
        </p>
      }

      @if (error()) {
        <gsc-alert kind="error" heading="Could not explain this phrase">
          <p>{{ error() }}</p>
        </gsc-alert>
      }
      @if (blockedReason()) {
        <p class="text-sm text-stone-600" data-testid="explanation-blocked">
          {{ blockedReason() }}
        </p>
      }
      @if (!explanation() || stale() || error()) {
        <button
          type="button"
          class="btn-primary"
          [disabled]="busy() || !!blockedReason()"
          (click)="explain.emit()"
          data-testid="explain"
        >
          {{
            busy()
              ? 'Explaining…'
              : explanation()
                ? 'Update explanation'
                : 'Explain this phrase'
          }}
        </button>
      }
    </section>
  `,
})
export class ExplanationComponent {
  readonly explanation = input<Explanation | null>(null);
  readonly stale = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  /** Why explaining is unavailable right now (e.g. unsaved edits). */
  readonly blockedReason = input<string | null>(null);
  /** Note number (1-based column) for each event id, for citations. */
  readonly stepOf = input<Readonly<Record<string, number>>>({});
  readonly explain = output<void>();

  protected readonly observations = computed(() =>
    (this.explanation()?.points ?? []).filter((p) => p.kind === 'observation'),
  );
  protected readonly interpretations = computed(() =>
    (this.explanation()?.points ?? []).filter(
      (p) => p.kind === 'interpretation',
    ),
  );

  protected cites(p: ExplanationPoint): string {
    const steps = [
      ...new Set(p.eventIds.map((id) => this.stepOf()[id]).filter(Boolean)),
    ].sort((a, b) => a - b);
    return steps.length === 1
      ? `note ${steps[0]}`
      : `notes ${steps.join(', ')}`;
  }
}
