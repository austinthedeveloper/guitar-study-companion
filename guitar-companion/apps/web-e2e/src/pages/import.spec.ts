import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import {
  countInterpretRequests,
  dragSelect,
  fillDetails,
  reachReview,
  recognize,
  selectPassage,
  upload,
  useFakeScenario,
} from '../support/import-flow';

test.describe('Import page', { tag: routeTag(ROUTE_PATHS.import) }, () => {
  test.describe('upload', () => {
    test('renders the upload step and is accessible', async ({ page }) => {
      await page.goto('/import');
      await expect(page).toHaveTitle(/Import/);
      await expect(page.getByTestId('step-upload')).toBeVisible();
      await expectNoA11yViolations(page);
    });

    test('rejects unsupported and oversized files', async ({ page }) => {
      await page.goto('/import');
      await page.getByTestId('file-input').setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('hi'),
      });
      await expect(page.getByTestId('alert')).toContainText(
        'Unsupported file type',
      );

      await page.getByTestId('file-input').setInputFiles({
        name: 'huge.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(31 * 1024 * 1024),
      });
      await expect(page.getByTestId('alert')).toContainText('too large');
      await expect(page.getByTestId('step-upload')).toBeVisible();
    });

    test('reports images that cannot be decoded', async ({ page }) => {
      await page.goto('/import');
      await page.getByTestId('file-input').setInputFiles({
        name: 'broken.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('not really a jpeg'),
      });
      await expect(page.getByTestId('alert')).toContainText(
        'Could not read that image',
      );
    });

    for (const file of [
      'synthetic-lick.png',
      'synthetic-lick.jpg',
      'synthetic-lick.heic',
    ]) {
      test(`loads ${file.split('.').pop()?.toUpperCase()} photos`, async ({
        page,
      }) => {
        await page.goto('/import');
        await upload(page, file);
        await expect(page.getByTestId('file-name')).toHaveText(file);
      });
    }
  });

  test.describe('passage selection', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/import');
      await upload(page, 'synthetic-lick.png');
    });

    test('requires a usable selection before continuing', async ({ page }) => {
      await expect(page.getByTestId('selection-next')).toBeDisabled();
      await dragSelect(page, [0.5, 0.5], [0.51, 0.51]);
      await expect(page.getByTestId('selection-next')).toBeDisabled();
      await page.getByTestId('select-all').click();
      await expect(page.getByTestId('selection-next')).toBeEnabled();
      await page.getByTestId('clear-selection').click();
      await expect(page.getByTestId('selection-box')).toHaveCount(0);
    });

    test('rotates and zooms the page image', async ({ page }) => {
      const canvas = page.getByTestId('cropper-canvas');
      const before = await canvas.evaluate((c: HTMLCanvasElement) => [
        c.width,
        c.height,
      ]);
      await page.getByTestId('rotate-right').click();
      await expect(canvas).toHaveAttribute('aria-label', /rotated 90 degrees/);
      const after = await canvas.evaluate((c: HTMLCanvasElement) => [
        c.width,
        c.height,
      ]);
      expect(after).toEqual([before[1], before[0]]);

      await expect(page.getByTestId('zoom-level')).toHaveText('100%');
      await page.getByTestId('zoom-in').click();
      await expect(page.getByTestId('zoom-level')).toHaveText('150%');
      await page.getByTestId('zoom-out').click();
      await page.getByTestId('zoom-out').click();
      await expect(page.getByTestId('zoom-level')).toHaveText('75%');
    });

    test('straightens a tilted page with guides', async ({ page }) => {
      const canvas = page.getByTestId('cropper-canvas');
      const size = () =>
        canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
      const before = await size();
      const tilt = page.getByTestId('tilt');
      await expect(page.getByTestId('tilt-reset')).toBeDisabled();
      await tilt.focus();
      await expect(page.getByTestId('tilt-guides')).toBeVisible();
      await tilt.fill('4');
      await expect(page.getByTestId('tilt-level')).toHaveText('4°');
      await expect(canvas).toHaveAttribute('aria-label', /straightened 4°/);
      // A tilted page is redrawn into its (differently shaped) bounding box.
      expect(await size()).not.toEqual(before);

      await page.getByTestId('tilt-reset').click();
      await expect(page.getByTestId('tilt-level')).toHaveText('0°');
      await page.getByTestId('select-all').click();
      await expect(page.getByTestId('selection-next')).toBeEnabled();
    });

    test('moves the selection with the keyboard', async ({ page }) => {
      await page.getByTestId('select-all').click();
      const box = page.getByTestId('selection-box');
      await box.focus();
      await page.keyboard.press('Shift+ArrowLeft');
      await page.keyboard.press('Shift+ArrowUp');
      const width = await box.evaluate((el) => (el as HTMLElement).style.width);
      expect(parseFloat(width)).toBeLessThan(100);
    });

    test('is accessible', async ({ page }) => {
      await page.getByTestId('select-all').click();
      await expectNoA11yViolations(page);
    });
  });

  test.describe('details and consent', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/import');
      await upload(page, 'synthetic-lick.png');
      await selectPassage(page);
    });

    test('shows the crop and requires a book title', async ({ page }) => {
      await expect(page.getByTestId('crop-preview')).toBeVisible();
      await page.getByTestId('recognize').click();
      await expect(page.getByText('Enter the book title')).toBeVisible();
      await expect(page.getByTestId('consent-dialog')).toBeHidden();
      await expectNoA11yViolations(page);
    });

    test('declining consent sends nothing to the AI provider', async ({
      page,
    }) => {
      const sent = countInterpretRequests(page);
      await fillDetails(page);
      await page.getByTestId('recognize').click();
      await expect(page.getByTestId('consent-dialog')).toBeVisible();
      await expect(page.getByTestId('consent-dialog')).toContainText(
        'Only the selected area',
      );
      await page.getByTestId('consent-decline').click();
      await expect(page.getByTestId('consent-dialog')).toBeHidden();
      await expect(page.getByTestId('step-details')).toBeVisible();
      expect(sent()).toBe(0);
    });

    test('escape also declines consent', async ({ page }) => {
      const sent = countInterpretRequests(page);
      await fillDetails(page);
      await page.getByTestId('recognize').click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('consent-dialog')).toBeHidden();
      expect(sent()).toBe(0);
    });

    test('consent dialog is accessible', async ({ page }) => {
      await fillDetails(page);
      await page.getByTestId('recognize').click();
      await expect(page.getByTestId('consent-dialog')).toBeVisible();
      await expectNoA11yViolations(page);
    });
  });

  test.describe('AI failures are recoverable', () => {
    for (const [scenario, message] of [
      ['unavailable', 'unavailable'],
      ['invalid-output', 'unusable result'],
      ['timeout', 'took too long'],
    ] as const) {
      test(`${scenario}: shows a message and offers retry and manual entry`, async ({
        page,
      }) => {
        await useFakeScenario(page, scenario);
        await page.goto('/import');
        await upload(page, 'synthetic-lick.png');
        await selectPassage(page);
        await fillDetails(page);
        await recognize(page);
        await expect(page.getByTestId('interpret-error')).toContainText(
          message,
        );
        await expect(page.getByTestId('recognize')).toHaveText('Try again');

        await useFakeScenario(page, 'default');
        await recognize(page);
        await expect(page.getByTestId('step-review')).toBeVisible();
      });
    }

    test('a failure after corrections keeps the corrected notes', async ({
      page,
    }) => {
      await reachReview(page);
      await page.getByTestId('cell-0-1').fill('16');
      await page.getByTestId('cell-0-1').blur();
      await page.getByTestId('review-back').click();

      await useFakeScenario(page, 'unavailable');
      await recognize(page);
      await expect(page.getByTestId('interpret-error')).toBeVisible();
      await expect(
        page.getByText('Your corrected notes are safe.'),
      ).toBeVisible();
      await page.getByTestId('enter-manually').click();
      await expect(page.getByTestId('cell-0-1')).toHaveValue('16');
    });
  });

  test.describe('review and correction', () => {
    test('shows the draft, flags notes needing review, and leaves rhythm unknown', async ({
      page,
    }) => {
      await reachReview(page);
      await expect(page.getByTestId('review-crop')).toBeVisible();
      await expect(page.getByTestId('recognition-summary')).toContainText(
        'Draft from fake',
      );
      await expect(page.getByTestId('review-count')).toContainText(
        '1 note(s) need review',
      );
      await expect(page.getByTestId('cell-3-1')).toHaveAttribute(
        'data-review',
        'true',
      );
      await expect(page.getByTestId('cell-0-1')).toHaveValue('15');
      await expect(page.getByTestId('cell-5-2')).toHaveValue('14');
      await expect(page.getByTestId('cell-5-1')).toHaveValue('15');

      await expect(page.getByTestId('rhythm-known')).not.toBeChecked();
      await expect(page.getByTestId('rhythm-unknown-note')).toBeVisible();
      await page.getByTestId('column-0').click();
      await expect(page.getByTestId('duration-1')).toBeDisabled();
      await expect(page.getByTestId('duration-1')).toHaveValue('');
    });

    test('partial rhythm is cleared, not guessed', async ({ page }) => {
      await reachReview(page, 'partial-rhythm');
      await expect(page.getByTestId('rhythm-known')).not.toBeChecked();
      await expect(page.getByTestId('uncertainties')).toContainText(
        'Rhythm was only partly readable',
      );
    });

    test('known rhythm keeps durations', async ({ page }) => {
      await reachReview(page, 'rhythm-known');
      await expect(page.getByTestId('rhythm-known')).toBeChecked();
      await page.getByTestId('column-0').click();
      await expect(page.getByTestId('duration-1')).toHaveValue('240');
    });

    test('impossible recognized notes are removed and reported', async ({
      page,
    }) => {
      await reachReview(page, 'invalid-events');
      await expect(page.getByTestId('rejected-alert')).toContainText(
        '2 recognized note(s)',
      );
    });

    test('empty recognition shows an empty editor', async ({ page }) => {
      await reachReview(page, 'empty');
      await expect(page.getByTestId('tab-editor-empty')).toBeVisible();
      await expect(page.getByTestId('uncertainties')).toContainText(
        'No tablature found',
      );
      await expect(page.getByTestId('save-phrase')).toBeDisabled();
    });

    test('edits strings, frets, order, and techniques with validation', async ({
      page,
    }) => {
      await reachReview(page);
      await page.getByTestId('phrase-title').fill('Edited lick');

      // Fret change and a dead note
      await page.getByTestId('cell-1-0').fill('12');
      await page.getByTestId('cell-1-0').blur();
      await page.getByTestId('cell-2-4').fill('x');
      await page.getByTestId('cell-2-4').blur();
      await expect(page.getByTestId('cell-2-4')).toHaveValue('x');

      // Bend without amount blocks saving until fixed
      await page.getByTestId('column-1').click();
      await page
        .getByTestId('note-panel-0')
        .getByLabel('Bend', { exact: true })
        .check();
      await expect(page.getByTestId('issues-summary')).toContainText(
        'Bends need an amount',
      );
      await expect(page.getByTestId('save-phrase')).toBeDisabled();
      await page.getByTestId('bend-0').selectOption({ label: '½' });
      await expect(page.getByTestId('issues-summary')).toHaveCount(0);

      // Reorder and insert/delete positions
      await page.getByTestId('move-right').click();
      await expect(page.getByTestId('cell-2-0')).toHaveValue('12');
      await page.getByTestId('insert-before').click();
      await expect(page.getByTestId('cell-3-0')).toHaveValue('12');
      await page.getByTestId('delete-column').click();
      await expect(page.getByTestId('cell-2-0')).toHaveValue('12');

      await expect(page.getByTestId('save-phrase')).toBeEnabled();
      await expectNoA11yViolations(page);
    });

    test('a new recognition never silently replaces corrections', async ({
      page,
    }) => {
      await reachReview(page);
      await page.getByTestId('cell-0-1').fill('16');
      await page.getByTestId('cell-0-1').blur();
      await page.getByTestId('review-back').click();
      await recognize(page);
      await expect(page.getByText('New recognition ready')).toBeVisible();
      await page.getByTestId('keep-notes').click();
      await expect(page.getByTestId('cell-0-1')).toHaveValue('16');

      await page.getByTestId('review-back').click();
      await recognize(page);
      await page.getByTestId('replace-notes').click();
      await expect(page.getByTestId('cell-0-1')).toHaveValue('15');
    });
  });
});
