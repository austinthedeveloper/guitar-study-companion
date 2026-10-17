import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';

test.describe('Privacy page', { tag: routeTag(ROUTE_PATHS.privacy) }, () => {
  test('explains what is stored and sent, reachable from the footer', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Footer' })
      .getByRole('link', { name: 'Privacy and your data' })
      .click();
    await expect(page).toHaveTitle(/Privacy/);
    const privacy = page.getByTestId('privacy');
    await expect(privacy).toContainText('Photos stay on your device');
    await expect(privacy).toContainText('not stored by this app');
    await expect(privacy).toContainText('Delete phrase');
    await expectNoA11yViolations(page);
  });
});
