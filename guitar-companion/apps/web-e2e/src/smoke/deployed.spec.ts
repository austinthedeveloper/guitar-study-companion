import { expect, test } from '@playwright/test';
import { HealthResponseSchema } from '@gsc/contracts';

/**
 * Deployed smoke suite (`--grep @smoke`). Read-only: it creates no user data.
 * Against Azure, BASE_URL is the static site and SMOKE_API_URL the Function
 * App (separate origins, ADR-013). Locally both default to the e2e stack.
 */
const apiUrl = process.env['SMOKE_API_URL'] ?? '';
const expectedVersion = process.env['SMOKE_EXPECT_VERSION'];

test.describe('Deployed smoke', { tag: '@smoke' }, () => {
  test('API health is ok with the database reachable', async ({ request }) => {
    const res = await request.get(`${apiUrl}/api/health`);
    expect(res.status()).toBe(200);
    const body = HealthResponseSchema.parse(await res.json());
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('up');
    if (expectedVersion) expect(body.version).toBe(expectedVersion);
  });

  test('the phrase library query answers', async ({ request }) => {
    const res = await request.get(`${apiUrl}/api/phrases`);
    expect(res.status()).toBe(200);
  });

  test('the site loads the app shell and reaches the API', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Guitar Study Companion');
    await expect(page.getByTestId('api-status')).toHaveAttribute(
      'data-state',
      'ok',
    );
    await expect(page.getByTestId('api-database')).toHaveText('up');
  });

  test('a deep link renders its page', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveTitle(/Privacy/);
    await expect(page.getByTestId('privacy')).toBeVisible();
  });
});
