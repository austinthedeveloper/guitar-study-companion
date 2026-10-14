import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';

test.describe('Not found page', { tag: routeTag(ROUTE_PATHS.notFound) }, () => {
  test('deep link to an unknown route renders not-found (SPA fallback)', async ({
    page,
  }) => {
    const response = await page.goto('/does/not/exist');
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('not-found')).toBeVisible();
    await expect(page).toHaveTitle(/Not found/);
  });

  test('links back home', async ({ page }) => {
    await page.goto('/nope');
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Learn from music',
    );
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/nope');
    await expect(page.getByTestId('not-found')).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
