import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** What the app stores, what it sends to AI, and how to remove it. */
@Component({
  selector: 'gsc-privacy-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="max-w-2xl space-y-5 text-stone-800" data-testid="privacy">
      <h1 class="text-2xl font-semibold text-stone-900">
        Privacy and your data
      </h1>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold">Book photos</h2>
        <p>
          Photos stay on your device. Only the passage you select is sent, and
          only after you agree in the consent dialog each time. It goes to the
          AI service that reads the tab (OpenAI or Anthropic, depending on the
          setup) and is not stored by this app. The service's own data policy
          applies to what it receives.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold">What is saved</h2>
        <p>
          Your corrected phrases (notes, tuning, key, chords), the source
          details you type, your tags, favorites and notes, practice plans and
          progress, and AI explanations and tips. Nothing listens to your
          playing.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold">What AI sees after import</h2>
        <p>
          Explanations and practice tips are written from facts the app computes
          from your verified notes, plus the key and chords you entered. No
          image is sent for these. AI text is always labelled as AI.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold">Deleting</h2>
        <p>
          "Delete phrase" on a phrase's page removes it along with its practice
          plans and progress. Phrases you made from it (transpositions,
          variations) are kept.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold">Books and copyright</h2>
        <p>
          This app is for studying music you own. Saved phrases are private to
          you. Please don't use it to copy or share whole songs or pages from
          books.
        </p>
      </section>

      <a routerLink="/phrases" class="text-brand-700 underline"
        >Back to my phrases</a
      >
    </article>
  `,
})
export class PrivacyPage {}
