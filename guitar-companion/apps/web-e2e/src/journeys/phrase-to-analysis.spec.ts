import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import { reachReview } from '../support/import-flow';

test.describe(
  'Journey: corrected phrase → musical analysis',
  { tag: [routeTag(ROUTE_PATHS.import), routeTag(ROUTE_PATHS.phrase)] },
  () => {
    test('set harmony, see roles, explain, correct an assumption, re-explain', async ({
      page,
    }) => {
      // The fake draft: D5 bent to E5, G5, A5, E5, D5, then A4+D5.
      await reachReview(page);
      await page.getByTestId('phrase-title').fill(`Analysis ${Date.now()}`);
      await page.getByTestId('save-phrase').click();
      await expect(page.getByTestId('phrase-heading')).toBeVisible();

      // Verified facts need no assumptions.
      await expect(page.getByTestId('note-row').first()).toContainText(
        'D5 → E5',
      );
      await expect(page.getByTestId('note-facts')).toContainText(
        'No key given',
      );

      // State the harmony: A7 for four notes, then D7.
      await page.getByTestId('harmony-key').fill('A');
      await page.getByTestId('harmony-chords').fill('A7 D7');
      const chordAt = page.getByTestId('chord-select');
      await chordAt.nth(0).selectOption('A7');
      await chordAt.nth(4).selectOption('D7');
      await expect(page.getByTestId('tab-chord-0')).toHaveText('A7');
      await expect(page.getByTestId('tab-chord-4')).toHaveText('D7');
      // The bend goes from the 4 to the 5 of A7; D5 is the root of D7.
      await expect(page.getByTestId('cell-role-0-1')).toHaveText('4→5');
      await expect(page.getByTestId('cell-role-2-0')).toHaveText('R');
      await expect(page.getByTestId('cell-role-4-1')).toHaveText('R');
      await expect(page.getByTestId('scales-certainty')).not.toBeEmpty();
      await page.getByTestId('harmony-save').click();
      await expect(page.getByTestId('harmony-dirty')).toHaveCount(0);

      // Explanation: observations (cited) apart from interpretations (assumed).
      await page.getByTestId('explain').click();
      await expect(page.getByTestId('explanation-observation')).toContainText(
        'Opens on D5, the 4 of A7.',
      );
      await expect(
        page.getByTestId('explanation-interpretation'),
      ).toContainText('Assumes:');
      await expect(page.getByTestId('explanation-stale')).toHaveCount(0);
      await expectNoA11yViolations(page);

      // Correct an assumption: D7 actually arrives one note earlier.
      await chordAt.nth(4).selectOption('');
      await chordAt.nth(3).selectOption('D7');
      // Re-analysis is immediate: E5 is now the 2 of D7.
      await expect(page.getByTestId('cell-role-3-1')).toHaveText('2');
      await expect(page.getByTestId('explanation-blocked')).toBeVisible();
      await page.getByTestId('harmony-save').click();
      await expect(page.getByTestId('explanation-stale')).toBeVisible();

      await page.getByTestId('explain').click();
      await expect(page.getByTestId('explanation-stale')).toHaveCount(0);

      // Everything persists.
      await page.reload();
      await expect(page.getByTestId('tab-chord-3')).toHaveText('D7');
      await expect(page.getByTestId('explanation-summary')).toBeVisible();
      await expect(page.getByTestId('explanation-stale')).toHaveCount(0);
    });
  },
);
