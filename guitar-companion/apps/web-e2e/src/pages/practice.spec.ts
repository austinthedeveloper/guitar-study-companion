import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import { createPhrase } from '../support/api';
import { audioLog, stubAudio } from '../support/audio-stub';

test.describe('Practice page', { tag: routeTag(ROUTE_PATHS.practice) }, () => {
  test.beforeEach(async ({ page }) => {
    await stubAudio(page);
  });

  test('builds a plan from settings, with rule steps and labelled AI tips', async ({
    page,
    request,
  }) => {
    // Sample phrase: E5 bent to F#5, then G5; one chord, so "apply" is assumed.
    const phrase = await createPhrase(request, `Practice ${Date.now()}`, {
      chords: 'E7',
    });
    await page.goto(`/phrases/${phrase.id}`);
    await page.getByTestId('practice-link').click();
    await expect(page).toHaveURL(`/phrases/${phrase.id}/practice`);
    await expect(page).toHaveTitle(/Practice/);
    await expect(page.getByTestId('plan-empty')).toBeVisible();

    await page.getByTestId('plan-difficulty').selectOption('easy');
    await page.getByTestId('plan-build').click();
    await expect(page.getByTestId('exercise-title')).toHaveText([
      'Bend in tune',
      'Whole phrase, slowly',
      'Over E7',
    ]);
    const bend = page.getByTestId('exercise').first();
    await expect(bend.getByTestId('exercise-references')).toContainText(
      'string 2, fret 19',
    );
    // Tab columns use the phrase's note numbers, matching the text.
    const slow = page.getByTestId('exercise').nth(1);
    await expect(slow.locator('thead th span')).toHaveText(['1', '2']);
    await expect(bend.getByTestId('exercise-coaching')).toContainText(
      'Tips (written by AI)',
    );
    // Easy: 60 bpm target, starting at half.
    await expect(page.getByTestId('tempo-range').nth(1)).toHaveText(
      '30 → 60 bpm',
    );
    await expect(page.getByTestId('plan-build')).toHaveText('Rebuild plan');
    await expectNoA11yViolations(page);
  });

  test('plays notes and runs the metronome (stubbed audio and clock)', async ({
    page,
    request,
  }) => {
    await page.clock.install();
    const phrase = await createPhrase(request, `Audio ${Date.now()}`);
    await page.goto(`/phrases/${phrase.id}/practice`);
    await page.getByTestId('plan-build').click();
    const slow = page
      .getByTestId('exercise')
      .filter({ hasText: 'Whole phrase' });

    await slow.getByTestId('play').click();
    await expect(slow.getByTestId('stop')).toBeVisible();
    expect(
      (await audioLog(page)).filter((l) => l.startsWith('note')),
    ).toHaveLength(2);
    // Two notes at 48 bpm ≈ 2.5 s, then it finishes on its own.
    await page.clock.runFor(3000);
    await expect(slow.getByTestId('play')).toBeVisible();

    await slow.getByTestId('tempo-up').click();
    await expect(slow.getByTestId('tempo')).toHaveText('53 bpm');
    await slow.getByTestId('metronome').click();
    await expect(slow.getByTestId('metronome')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.clock.runFor(2500);
    await expect(slow.getByTestId('beat')).not.toHaveAttribute(
      'data-beat',
      '0',
    );
    expect(
      (await audioLog(page)).filter((l) => l.startsWith('click')).length,
    ).toBeGreaterThan(1);
    await slow.getByTestId('metronome').click();
    await expect(slow.getByTestId('beat')).toHaveCount(0);
  });

  test('keeps progress and notes across reloads', async ({ page, request }) => {
    const phrase = await createPhrase(request, `Progress ${Date.now()}`);
    await page.goto(`/phrases/${phrase.id}/practice`);
    await page.getByTestId('plan-build').click();
    const first = page.getByTestId('exercise').first();
    await first.getByTestId('tempo-up').click();
    await first.getByTestId('exercise-done').check();
    await expect(page.getByTestId('plan-progress')).toContainText(
      '1 of 2 done',
    );
    await page.getByTestId('session-notes').fill('Bend runs flat.');
    await page.getByTestId('session-notes').blur();
    await expect(page.getByTestId('plan-progress')).toContainText('Saved');

    await page.reload();
    await expect(page.getByTestId('plan-progress')).toContainText(
      '1 of 2 done',
    );
    await expect(first.getByTestId('exercise-done')).toBeChecked();
    await expect(first.getByTestId('exercise-best')).toHaveText(
      '· best 53 bpm',
    );
    await expect(page.getByTestId('session-notes')).toHaveValue(
      'Bend runs flat.',
    );
  });

  test('marks a plan stale after the phrase changes, and still builds without AI tips', async ({
    page,
    request,
  }) => {
    const phrase = await createPhrase(request, `Stale plan ${Date.now()}`);
    await page.route('**/api/phrases/*/plans', (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          'x-gsc-fake-scenario': 'unavailable',
        },
      }),
    );
    await page.goto(`/phrases/${phrase.id}/practice`);
    await page.getByTestId('plan-build').click();
    await expect(page.getByTestId('plan-uncoached')).toBeVisible();
    await expect(page.getByTestId('exercise-coaching')).toHaveCount(0);

    await page.goto(`/phrases/${phrase.id}`);
    await page.getByTestId('harmony-key').fill('E');
    await page.getByTestId('harmony-save').click();
    await expect(page.getByTestId('harmony-dirty')).toHaveCount(0);
    await page.goto(`/phrases/${phrase.id}/practice`);
    await expect(page.getByTestId('plan-stale')).toBeVisible();
  });

  test('shows not found and build errors', async ({ page, request }) => {
    await page.goto('/phrases/000000000000000000000000/practice');
    await expect(page.getByTestId('practice-not-found')).toBeVisible();

    const phrase = await createPhrase(request, `Build error ${Date.now()}`);
    await page.route('**/api/phrases/*/plans', (route) =>
      route.fulfill({
        status: 500,
        json: { error: { code: 'internal', message: 'Boom', retryable: true } },
      }),
    );
    await page.goto(`/phrases/${phrase.id}/practice`);
    await page.getByTestId('plan-build').click();
    await expect(page.getByTestId('practice')).toContainText(
      'Could not build a plan',
    );
  });
});
