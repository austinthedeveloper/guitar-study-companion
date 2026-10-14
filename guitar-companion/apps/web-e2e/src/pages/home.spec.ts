import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';

test.describe('Home page', { tag: routeTag(ROUTE_PATHS.home) }, () => {
  test('renders shell and live API health from the real backend', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Guitar Study Companion');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Learn from music',
    );
    await expect(
      page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('link', { name: 'Home' }),
    ).toHaveAttribute('aria-current', 'page');

    const status = page.getByTestId('api-status');
    await expect(status).toHaveAttribute('data-state', 'ok');
    await expect(page.getByTestId('api-database')).toHaveText('up');
    await expect(page.getByTestId('api-ai-provider')).toHaveText('fake');
    await expect(page.getByTestId('api-version')).toHaveText('e2e');
  });

  test('shows a degraded state when the database is down', async ({ page }) => {
    await page.route('**/api/health', (route) =>
      route.fulfill({
        json: {
          status: 'degraded',
          version: 'e2e',
          time: new Date().toISOString(),
          checks: { database: 'down', aiProvider: 'fake' },
        },
      }),
    );
    await page.goto('/');
    await expect(page.getByTestId('api-status')).toHaveAttribute(
      'data-state',
      'degraded',
    );
    await expect(page.getByTestId('api-database')).toHaveText('down');
  });

  test('shows an error state when the API is unreachable', async ({ page }) => {
    await page.route('**/api/health', (route) =>
      route.abort('connectionrefused'),
    );
    await page.goto('/');
    await expect(page.getByTestId('api-status')).toHaveAttribute(
      'data-state',
      'error',
    );
    await expect(page.getByTestId('api-status')).toContainText(
      'Could not reach the API',
    );
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('api-status')).toHaveAttribute(
      'data-state',
      'ok',
    );
    await expectNoA11yViolations(page);
  });
});
