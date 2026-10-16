import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ScaleAnalysis } from '@gsc/music-domain';

/**
 * Scale suggestions. These are inferences, so the panel leads with how
 * certain they are and why, and never presents one as the answer when
 * several fit.
 */
@Component({
  selector: 'gsc-scale-candidates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="space-y-3 rounded-lg border border-stone-300 bg-white p-4"
      aria-labelledby="scales-heading"
      data-testid="scales"
    >
      <header>
        <h2 id="scales-heading" class="text-lg font-semibold">Likely scales</h2>
        <p class="text-sm text-stone-600">
          Suggestions from the notes plus your key and chords. Not a fact about
          the music.
        </p>
      </header>
      <p class="text-sm font-medium" data-testid="scales-certainty">
        {{ summary() }}
      </p>
      @if (analysis().candidates.length) {
        <ol class="space-y-2 text-sm">
          @for (c of analysis().candidates; track c.name; let first = $first) {
            <li
              class="rounded border p-2"
              [class]="
                first && analysis().certainty === 'clear'
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-stone-200'
              "
              data-testid="scale-candidate"
            >
              <div class="font-medium" data-testid="scale-name">
                {{ c.name }}
              </div>
              <div class="text-stone-700">{{ c.notes.join(' ') }}</div>
              @if (c.outside.length) {
                <div class="text-amber-800" data-testid="scale-outside">
                  Outside this scale: {{ c.outside.join(', ') }}
                </div>
              }
              @if (c.reasons.length) {
                <div class="text-stone-600">
                  Why: {{ c.reasons.join('; ') }}
                </div>
              }
            </li>
          }
        </ol>
      }
    </section>
  `,
})
export class ScaleCandidatesComponent {
  readonly analysis = input.required<ScaleAnalysis>();

  protected readonly summary = computed(() => {
    const { certainty, candidates } = this.analysis();
    if (certainty === 'insufficient')
      return 'Too few different notes to suggest a scale with any confidence.';
    if (certainty === 'ambiguous')
      return 'Several scales fit equally well. Adding a key or chords would narrow it down.';
    return `Best fit: ${candidates[0].name}.`;
  });
}
