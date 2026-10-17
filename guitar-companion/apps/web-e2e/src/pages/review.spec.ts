import { expect, test } from '@playwright/test';
import { API_PATHS, PracticePlan } from '@gsc/contracts';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import { createPhrase } from '../support/api';

test.describe('Review page', { tag: routeTag(ROUTE_PATHS.review) }, () => {
  test('lists unfinished practice and links to it, with history on the phrase', async ({
    page,
    request,
  }) => {
    const title = `Unfinished ${Date.now()}`;
    const phrase = await createPhrase(request, title);
    const plan = (await (
      await request.post(API_PATHS.phrasePlans(phrase.id), {
        data: {
          revision: 1,
          settings: { difficulty: 'medium', minutes: 15, focus: 'balanced' },
        },
      })
    ).json()) as PracticePlan;
    await request.put(API_PATHS.planSession(plan.id), {
      data: {
        progress: {
          [plan.exercises[0].id]: {
            completedAt: new Date().toISOString(),
            bestBpm: 60,
          },
        },
        notes: '',
      },
    });

    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Review' })
      .click();
    await expect(page).toHaveTitle(/Review/);
    const item = page.getByTestId('review-item').filter({ hasText: title });
    await expect(item).toHaveAttribute('data-kind', 'unfinished');
    await expect(item).toContainText(
      `1 of ${plan.exercises.length} exercises done.`,
    );
    await expectNoA11yViolations(page);

    await item.getByTestId('review-action').click();
    await expect(page).toHaveURL(`/phrases/${phrase.id}/practice`);
    await expect(page.getByTestId('plan-progress')).toContainText(
      `1 of ${plan.exercises.length} done`,
    );

    await page.goto(`/phrases/${phrase.id}`);
    await expect(page.getByTestId('history-entry')).toContainText(
      `1 of ${plan.exercises.length} done`,
    );
  });

  test('flags a plan built for an older version of the phrase', async ({
    page,
    request,
  }) => {
    const title = `Stale review ${Date.now()}`;
    const phrase = await createPhrase(request, title);
    await request.post(API_PATHS.phrasePlans(phrase.id), {
      data: {
        revision: 1,
        settings: { difficulty: 'medium', minutes: 15, focus: 'balanced' },
      },
    });
    await request.put(API_PATHS.phraseHarmony(phrase.id), {
      data: { revision: 1, key: 'E', chordChanges: [] },
    });
    await page.goto('/review');
    const item = page.getByTestId('review-item').filter({ hasText: title });
    await expect(item).toHaveAttribute('data-kind', 'stale-plan');
    await expect(item.getByTestId('review-action')).toHaveText('Rebuild plan');
  });

  test('shows empty and error states', async ({ page }) => {
    await page.route('**/api/review', (route) => route.fulfill({ json: [] }));
    await page.goto('/review');
    await expect(page.getByTestId('review-empty')).toBeVisible();

    let fail = true;
    await page.unroute('**/api/review');
    await page.route('**/api/review', (route) =>
      fail ? route.abort('connectionrefused') : route.fulfill({ json: [] }),
    );
    await page.reload();
    await expect(page.getByTestId('alert')).toContainText('Could not');
    fail = false;
    await page.getByTestId('retry').click();
    await expect(page.getByTestId('review-empty')).toBeVisible();
  });
});
