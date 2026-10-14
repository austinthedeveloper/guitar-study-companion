import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import { createPhrase } from '../support/api';

test.describe('My phrases page', { tag: routeTag(ROUTE_PATHS.phrases) }, () => {
  test('lists saved phrases and links to them', async ({ page, request }) => {
    const phrase = await createPhrase(request, `Listed ${Date.now()}`);
    await page.goto('/phrases');
    await expect(page).toHaveTitle(/My phrases/);
    await page.getByTestId(`phrase-link-${phrase.id}`).click();
    await expect(page).toHaveURL(`/phrases/${phrase.id}`);
    await expect(page.getByTestId('phrase-heading')).toHaveText(phrase.title);
  });

  test('shows an empty state', async ({ page }) => {
    await page.route('**/api/phrases', (route) => route.fulfill({ json: [] }));
    await page.goto('/phrases');
    await expect(page.getByTestId('phrases-empty')).toBeVisible();
    await page.getByTestId('phrases-empty').getByRole('link').click();
    await expect(page).toHaveURL('/import');
  });

  test('shows an error state with retry', async ({ page }) => {
    let fail = true;
    await page.route('**/api/phrases', (route) =>
      fail ? route.abort('connectionrefused') : route.fulfill({ json: [] }),
    );
    await page.goto('/phrases');
    await expect(page.getByTestId('alert')).toContainText(
      'Could not reach the server',
    );
    fail = false;
    await page.getByTestId('retry').click();
    await expect(page.getByTestId('phrases-empty')).toBeVisible();
  });

  test('is accessible', async ({ page, request }) => {
    await createPhrase(request, `A11y ${Date.now()}`);
    await page.goto('/phrases');
    await expect(page.getByTestId('phrase-list')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

test.describe(
  'Phrase detail page',
  { tag: routeTag(ROUTE_PATHS.phrase) },
  () => {
    test('shows a saved phrase read-only', async ({ page, request }) => {
      const phrase = await createPhrase(request, `Detail ${Date.now()}`);
      await page.goto(`/phrases/${phrase.id}`);
      await expect(page.getByTestId('phrase-heading')).toHaveText(phrase.title);
      await expect(page.getByTestId('tab-editor').locator('input')).toHaveCount(
        0,
      );
      await expect(page.getByTestId('cell-0-1')).toHaveText('17');
      await expect(page.getByTestId('phrase-rhythm')).toContainText('Unknown');
      await expectNoA11yViolations(page);
    });

    test('shows not found for unknown and malformed ids', async ({ page }) => {
      for (const id of ['0123456789abcdef01234567', 'not-an-id']) {
        await page.goto(`/phrases/${id}`);
        await expect(page.getByTestId('phrase-not-found')).toBeVisible();
      }
      await expectNoA11yViolations(page);
    });

    test('shows a retryable error when the API fails', async ({ page }) => {
      await page.route('**/api/phrases/*', (route) =>
        route.fulfill({
          status: 500,
          json: {
            error: {
              code: 'internal',
              message: 'Something went wrong. Please try again.',
              retryable: true,
            },
          },
        }),
      );
      await page.goto('/phrases/0123456789abcdef01234567');
      await expect(page.getByTestId('alert')).toContainText(
        'Something went wrong',
      );
    });
  },
);
