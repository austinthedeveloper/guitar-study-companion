import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import {
  fillDetails,
  reachReview,
  selectPassage,
  upload,
} from '../support/import-flow';

test.describe(
  'Journey: book photo → corrected phrase',
  {
    tag: [
      routeTag(ROUTE_PATHS.import),
      routeTag(ROUTE_PATHS.phrase),
      routeTag(ROUTE_PATHS.phrases),
    ],
  },
  () => {
    test('import, correct recognition, save, and find it again', async ({
      page,
    }) => {
      const title = `Journey lick ${Date.now()}`;
      await reachReview(page, 'default', 'synthetic-lick.heic');

      await page.getByTestId('phrase-title').fill(title);
      // Correct a misread note and fix the uncertain slide.
      await page.getByTestId('cell-0-1').fill('14');
      await page.getByTestId('cell-0-1').blur();
      await page.getByTestId('column-3').click();
      await page.getByTestId('note-panel-1').getByLabel('Slide').uncheck();
      await page.getByTestId('note-panel-1').getByLabel('Hammer-on').check();
      await page.getByTestId('save-phrase').click();

      await expect(page).toHaveURL(/\/phrases\/[0-9a-f]{24}$/);
      await expect(page.getByTestId('saved-banner')).toBeVisible();
      await expect(page.getByTestId('phrase-heading')).toHaveText(title);
      await expect(page.getByTestId('phrase-source')).toContainText(
        'E2E Test Book',
      );
      await expect(page.getByTestId('phrase-source')).toContainText('p. 12');
      await expect(page.getByTestId('phrase-rhythm')).toContainText('Unknown');
      await expect(page.getByTestId('phrase-origin')).toContainText(
        'AI draft (fake), corrected by you',
      );
      await expect(page.getByTestId('cell-0-1')).toHaveText('14');
      await expect(page.getByTestId('cell-5-2')).toHaveText('14');
      await expectNoA11yViolations(page);

      // Survives reload (persisted, not client state).
      const url = page.url();
      await page.reload();
      await expect(page.getByTestId('phrase-heading')).toHaveText(title);
      await expect(page.getByTestId('saved-banner')).toHaveCount(0);

      await page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('link', { name: 'My phrases' })
        .click();
      await page.getByRole('link', { name: new RegExp(title) }).click();
      await expect(page).toHaveURL(url);
    });

    test('manual entry without AI, with alternate tuning', async ({ page }) => {
      const title = `Manual lick ${Date.now()}`;
      await page.goto('/');
      await page.getByTestId('cta-import').click();
      await upload(page, 'synthetic-lick.jpg');
      await selectPassage(page);
      await fillDetails(page, 'Manual Book');
      await page.getByTestId('tuning').selectOption('drop-d');
      await page.getByTestId('capo').fill('2');
      await page.getByTestId('enter-manually').click();

      await expect(page.getByTestId('tab-editor-empty')).toBeVisible();
      await page.getByTestId('add-column').click();
      await page.getByTestId('cell-0-5').fill('0');
      await page.getByTestId('cell-0-5').blur();
      await page.getByTestId('add-column').click();
      await page.getByTestId('cell-1-4').fill('2');
      await page.getByTestId('cell-1-4').blur();
      await page.getByTestId('phrase-title').fill(title);
      await page.getByTestId('save-phrase').click();

      await expect(page.getByTestId('phrase-heading')).toHaveText(title);
      await expect(page.getByTestId('phrase-tuning')).toContainText('Drop D');
      await expect(page.getByTestId('phrase-origin')).toHaveText(
        'Entered manually',
      );
      await expect(page.getByTestId('cell-0-5')).toHaveText('0');
    });
  },
);
