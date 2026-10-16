import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import { stubAudio } from '../support/audio-stub';
import { reachReview } from '../support/import-flow';

test.describe(
  'Journey: lick → new key → variation over chords → practice',
  {
    tag: [
      routeTag(ROUTE_PATHS.import),
      routeTag(ROUTE_PATHS.phrase),
      routeTag(ROUTE_PATHS.transpose),
      routeTag(ROUTE_PATHS.practice),
    ],
  },
  () => {
    test('transpose with a chosen position and range, vary it, and practise the variation', async ({
      page,
    }) => {
      await stubAudio(page);
      const title = `Transfer ${Date.now()}`;
      // Fake draft: D5 bent to E5, G5, A5~, E5 (slide), D5, A4+D5.
      await reachReview(page);
      await page.getByTestId('phrase-title').fill(title);
      await page.getByTestId('save-phrase').click();
      await page.getByTestId('harmony-key').fill('A');
      await page.getByTestId('harmony-chords').fill('D');
      await page.getByTestId('harmony-save').click();
      await expect(page.getByTestId('harmony-dirty')).toHaveCount(0);

      // Into E, in 5th position, nothing above fret 12.
      await page.getByTestId('transpose-link').click();
      await page.getByTestId('transpose-to').fill('E');
      await page.getByTestId('transpose-position').selectOption({
        label: '5th position (frets 5–9)',
      });
      await page.getByTestId('transpose-max-fret').selectOption('12');
      await expect(page.getByTestId('transposed-heading')).toHaveText(
        'In E major (down 5 semitones)',
      );
      await expect(page.getByTestId('transpose-issues')).toHaveCount(0);
      const frets = (
        await page
          .getByTestId('transposed-tab')
          .locator('[data-testid^="cell-"]:not([data-testid^="cell-role"])')
          .allTextContents()
      )
        .filter((t) => /^\d+$/.test(t.trim()))
        .map(Number);
      expect(frets.length).toBeGreaterThan(0);
      expect(Math.max(...frets)).toBeLessThanOrEqual(12);
      // Roles carried over: the chord moved from D to A.
      await expect(
        page.getByTestId('transposed-tab').getByTestId('tab-chord-0'),
      ).toHaveText('A');
      await expectNoA11yViolations(page);

      // Apply over a progression in the new key.
      await page.getByTestId('apply-progression').fill('A D E');
      await expect(page.getByTestId('application-fit')).toHaveCount(3);

      // Keep the rhythmic variation and practise it.
      await page
        .getByTestId('variation')
        .filter({ hasText: 'Hold the targets' })
        .getByTestId('save-variation')
        .click();
      await expect(page.getByTestId('phrase-heading')).toContainText(
        'Hold the targets',
      );
      await expect(page.getByTestId('phrase-origin')).toContainText('from');
      await expect(page.getByTestId('phrase-rhythm')).toHaveText('Known');
      await page.getByTestId('practice-link').click();
      await page.getByTestId('plan-build').click();
      await expect(page.getByTestId('exercise').first()).toBeVisible();
      await expect(page.getByTestId('practice')).not.toContainText(
        'one note per click',
      );
    });
  },
);
