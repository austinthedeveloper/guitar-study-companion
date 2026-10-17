import { expect, test } from '@playwright/test';
import { API_PATHS } from '@gsc/contracts';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import { createPhrase, highStringLick, updateHarmony } from '../support/api';

test.describe('My phrases page', { tag: routeTag(ROUTE_PATHS.phrases) }, () => {
  test('lists saved phrases and links to them', async ({ page, request }) => {
    const phrase = await createPhrase(request, `Listed ${Date.now()}`);
    await page.goto('/phrases');
    await expect(page).toHaveTitle(/My phrases/);
    await page.getByTestId(`phrase-link-${phrase.id}`).click();
    await expect(page).toHaveURL(`/phrases/${phrase.id}`);
    await expect(page.getByTestId('phrase-heading')).toHaveText(phrase.title);
  });

  test('searches by words, key, technique, interval pattern, tag, and favorites', async ({
    page,
    request,
  }) => {
    const run = `lib${Date.now()}`;
    // A4 C5 D5 in A minor: m3 up, M2 up.
    const minor = await createPhrase(
      request,
      `${run} minor run`,
      { key: 'Am' },
      highStringLick(5, 8, 10),
    );
    // Sample phrase: E5 bent to F#5, then G5; with a bend.
    await createPhrase(request, `${run} bend lick`, { key: 'G' });
    await page.goto('/phrases');
    const rows = page.getByTestId('phrase-list').locator('li');
    await page.getByTestId('filter-q').fill(run);
    await expect(rows).toHaveCount(2);

    await page.getByTestId('filter-key').fill('am');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('minor run');
    await expect(rows.first()).toContainText('A minor');
    await page.getByTestId('filter-key').fill('');
    await page.getByTestId('filter-technique').selectOption('bend');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('bend lick');
    await page.getByTestId('filter-technique').selectOption('');
    await page.getByTestId('filter-interval').fill('m3 up, M2');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('minor run');
    await page.getByTestId('filter-interval').fill('thirds');
    await expect(page.getByTestId('library-search-error')).toContainText(
      'Use interval names',
    );
    await page.getByTestId('filter-interval').fill('P5 up');
    await expect(page.getByTestId('library-no-match')).toBeVisible();

    // Favorite, tag, and annotate from the phrase page.
    await page.goto(`/phrases/${minor.id}`);
    await page.getByTestId('meta-favorite').click();
    await page.getByTestId('meta-tags').fill('Warmup, blues');
    await page.getByTestId('meta-notes').fill('Good for the slow blues.');
    await page.getByTestId('meta-save').click();
    await expect(page.getByTestId('meta-status')).toHaveText('Saved');
    await page.reload();
    await expect(page.getByTestId('meta-favorite')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('meta-tags')).toHaveValue('warmup, blues');

    await page.goto('/phrases');
    await page.getByTestId('filter-q').fill(run);
    await page.getByTestId('filter-favorite').check();
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByTestId('phrase-favorite')).toBeVisible();
    await page.getByTestId('filter-favorite').uncheck();
    await page.getByTestId('filter-tag').fill('warmup');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByTestId('phrase-tag')).toHaveText([
      '#warmup',
      '#blues',
    ]);
    await page.getByTestId('filter-tag').fill('');
    await page.getByTestId('filter-q').fill(`${run} slow blues`);
    await expect(rows).toHaveCount(1);
    await expectNoA11yViolations(page);
  });

  test('deletes a phrase with its practice history after confirming', async ({
    page,
    request,
  }) => {
    const phrase = await createPhrase(request, `Delete me ${Date.now()}`);
    await request.post(API_PATHS.phrasePlans(phrase.id), {
      data: {
        revision: 1,
        settings: { difficulty: 'medium', minutes: 15, focus: 'balanced' },
      },
    });
    await page.goto(`/phrases/${phrase.id}`);
    const del = page.getByTestId('phrase-delete');
    await del.getByTestId('confirm-start').click();
    await expect(del.getByTestId('confirm-group')).toContainText(
      'Delete this phrase and its practice history?',
    );
    await del.getByTestId('confirm-cancel').click();
    await expect(del.getByTestId('confirm-start')).toBeVisible();
    await del.getByTestId('confirm-start').click();
    await del.getByTestId('confirm-yes').click();

    await expect(page).toHaveURL('/phrases');
    await expect(page.getByTestId('deleted-banner')).toBeVisible();
    await page.goto(`/phrases/${phrase.id}`);
    await expect(page.getByTestId('phrase-not-found')).toBeVisible();
    expect(
      (await request.get(API_PATHS.phraseLatestPlan(phrase.id))).status(),
    ).toBe(404);
  });

  test('saving library fields keeps unsaved harmony edits', async ({
    page,
    request,
  }) => {
    const phrase = await createPhrase(request, `Keep edits ${Date.now()}`);
    await page.goto(`/phrases/${phrase.id}`);
    await page.getByTestId('harmony-key').fill('E');
    await page.getByTestId('meta-tags').fill('later');
    await page.getByTestId('meta-save').click();
    await expect(page.getByTestId('meta-status')).toHaveText('Saved');
    await expect(page.getByTestId('harmony-key')).toHaveValue('E');
    await expect(page.getByTestId('harmony-dirty')).toBeVisible();
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

    test('shows computed note names and intervals', async ({
      page,
      request,
    }) => {
      const phrase = await createPhrase(request, `Notes ${Date.now()}`);
      await page.goto(`/phrases/${phrase.id}`);
      const facts = page.getByTestId('note-facts');
      await expect(facts).toContainText('No key given, so notes use sharps.');
      await expect(page.getByTestId('note-range')).toHaveText('E5 – G5');
      await expect(page.getByTestId('note-pitch-classes')).toHaveText('E F# G');
      const rows = page.getByTestId('note-row');
      await expect(rows.nth(0)).toContainText('E5 → F#5');
      // Measured from the bend target F#5 to G5.
      await expect(rows.nth(1)).toContainText('G5');
      await expect(rows.nth(1)).toContainText('m2 up');
    });

    test('assumes a lone chord for the whole phrase and labels roles', async ({
      page,
      request,
    }) => {
      const phrase = await createPhrase(request, `One chord ${Date.now()}`);
      await page.goto(`/phrases/${phrase.id}`);
      await expect(page.getByTestId('placement-help')).toContainText(
        'Add chords',
      );
      await page.getByTestId('harmony-chords').fill('E7 Cmaj13#11');
      await expect(page.getByTestId('unknown-chords')).toContainText(
        'Cmaj13#11',
      );
      await page.getByTestId('harmony-chords').fill('E7');
      await expect(page.getByTestId('placement-help')).toContainText(
        'Assumed: the whole phrase is over E7',
      );
      // E5 is the root, bent up to the 2 (F#5), then G5 is a b3 over E7.
      await expect(
        page.getByTestId('note-row').nth(0).getByTestId('note-role'),
      ).toHaveText(['R', '2']);
      await expect(
        page.getByTestId('note-row').nth(1).getByTestId('note-role'),
      ).toHaveText(['b3']);
      await expect(page.getByTestId('harmony-dirty')).toBeVisible();
    });

    test('places chords on notes and saves them', async ({ page, request }) => {
      const phrase = await createPhrase(request, `Placed ${Date.now()}`);
      await page.goto(`/phrases/${phrase.id}`);
      await page.getByTestId('harmony-key').fill('A');
      await page.getByTestId('harmony-chords').fill('E7 A7');
      await expect(page.getByTestId('placement-help')).toContainText(
        'Chord column',
      );
      await expect(page.getByTestId('note-role')).toHaveCount(0);
      const selects = page.getByTestId('chord-select');
      await selects.nth(0).selectOption('E7');
      await selects.nth(1).selectOption('A7');
      // G5 over A7 is the b7, a chord tone.
      await expect(
        page.getByTestId('note-row').nth(1).getByTestId('note-role'),
      ).toHaveText(['b7']);

      // Roles and chord changes appear on the tab itself.
      await expect(page.getByTestId('tab-chord-0')).toHaveText('E7');
      await expect(page.getByTestId('tab-chord-1')).toHaveText('A7');
      await expect(page.getByTestId('cell-role-0-1')).toHaveText('R→2');
      await expect(page.getByTestId('cell-role-1-0')).toHaveText('b7');
      await expect(page.getByTestId('tab-role-legend')).toBeVisible();

      await page.getByTestId('harmony-save').click();
      await expect(page.getByTestId('harmony-dirty')).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId('harmony-key')).toHaveValue('A');
      await expect(page.getByTestId('harmony-chords')).toHaveValue('E7 A7');
      await expect(selects.nth(1)).toHaveValue('A7');
      await expect(page.getByTestId('note-facts')).toContainText(
        'Spelled in A major.',
      );
      await expectNoA11yViolations(page);
    });

    test('rejects a harmony save from a stale page', async ({
      page,
      request,
    }) => {
      const phrase = await createPhrase(request, `Stale ${Date.now()}`);
      await page.goto(`/phrases/${phrase.id}`);
      await expect(page.getByTestId('harmony-key')).toBeVisible();
      // Someone else saves first.
      await updateHarmony(request, phrase.id, {
        revision: 1,
        key: 'G',
        chordChanges: [],
      });
      await page.getByTestId('harmony-key').fill('E');
      await page.getByTestId('harmony-save').click();
      await expect(page.getByTestId('harmony')).toContainText(
        'This phrase changed since you opened it',
      );
      await page.getByTestId('harmony-reload').click();
      await expect(page.getByTestId('harmony-key')).toHaveValue('G');
    });

    test('suggests scales and says how certain it is', async ({
      page,
      request,
    }) => {
      const few = await createPhrase(request, `Few ${Date.now()}`);
      await page.goto(`/phrases/${few.id}`);
      await expect(page.getByTestId('scales-certainty')).toContainText(
        'Too few different notes',
      );

      // A C D E G ending on E: A minor and C major pentatonic fit equally.
      const lick = await createPhrase(
        request,
        `Pentatonic ${Date.now()}`,
        {},
        highStringLick(5, 8, 10, 12, 15, 12),
      );
      await page.goto(`/phrases/${lick.id}`);
      await expect(page.getByTestId('scales-certainty')).toContainText(
        'Several scales fit equally well',
      );
      await expect(page.getByTestId('scale-name').first()).toBeVisible();

      // Giving a key resolves it, live and with the reason shown.
      await page.getByTestId('harmony-key').fill('Am');
      await expect(page.getByTestId('scales-certainty')).toHaveText(
        'Best fit: A minor pentatonic.',
      );
      await expect(page.getByTestId('scale-candidate').first()).toContainText(
        'matches the key you gave (A minor)',
      );
      await expectNoA11yViolations(page);
    });

    test('explains a phrase with cited notes, kept apart from assumptions', async ({
      page,
      request,
    }) => {
      const phrase = await createPhrase(request, `Explain ${Date.now()}`, {
        chords: 'E7',
      });
      await page.goto(`/phrases/${phrase.id}`);
      await page.getByTestId('explain').click();
      await expect(page.getByTestId('explanation-summary')).toContainText(
        'Synthetic explanation',
      );
      await expect(page.getByTestId('explanation-observation')).toHaveText(
        'Opens on E5, the R (chord tone) of E7. (note 1)',
      );
      await expect(
        page.getByTestId('explanation-interpretation'),
      ).toContainText('Assumes: One chord is assumed for the whole phrase.');
      await expect(page.getByTestId('explain')).toHaveCount(0);

      // A point's citation highlights its notes in the tab, and toggles off.
      const show = page.getByTestId('explanation-show').first();
      await show.click();
      await expect(show).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-highlighted="true"]')).toHaveCount(1);
      await show.click();
      await expect(page.locator('[data-highlighted="true"]')).toHaveCount(0);
      await expectNoA11yViolations(page);

      // Persisted with the phrase.
      await page.reload();
      await expect(page.getByTestId('explanation-summary')).toBeVisible();
    });

    test('marks the explanation stale when harmony changes', async ({
      page,
      request,
    }) => {
      const phrase = await createPhrase(request, `Stale ex ${Date.now()}`, {
        chords: 'E7',
      });
      await page.goto(`/phrases/${phrase.id}`);
      await page.getByTestId('explain').click();
      await expect(page.getByTestId('explanation-summary')).toBeVisible();

      await page.getByTestId('harmony-key').fill('E');
      // Unsaved edits: the server would explain the saved phrase instead.
      await expect(page.getByTestId('explanation-blocked')).toContainText(
        'Save your harmony changes first',
      );
      await page.getByTestId('harmony-save').click();
      await expect(page.getByTestId('explanation-stale')).toBeVisible();
      await expect(page.getByTestId('explain')).toHaveText(
        'Update explanation',
      );
      await page.getByTestId('explain').click();
      await expect(page.getByTestId('explanation-stale')).toHaveCount(0);
    });

    test('recovers from an explanation failure', async ({ page, request }) => {
      const phrase = await createPhrase(request, `Ex fail ${Date.now()}`);
      let fail = true;
      await page.route('**/api/phrases/*/explanation', (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            ...(fail ? { 'x-gsc-fake-scenario': 'unavailable' } : {}),
          },
        }),
      );
      await page.goto(`/phrases/${phrase.id}`);
      await page.getByTestId('explain').click();
      await expect(page.getByTestId('explanation')).toContainText(
        'The explanation service is unavailable',
      );
      fail = false;
      await page.getByTestId('explain').click();
      await expect(page.getByTestId('explanation-summary')).toBeVisible();
    });

    test('spells notes in the phrase key, or says when the key is unclear', async ({
      page,
      request,
    }) => {
      const flat = await createPhrase(request, `Flat ${Date.now()}`, {
        key: 'Bb minor',
      });
      await page.goto(`/phrases/${flat.id}`);
      await expect(page.getByTestId('note-facts')).toContainText(
        'Spelled in Bb minor.',
      );
      await expect(page.getByTestId('note-row').nth(0)).toContainText(
        'E5 → Gb5',
      );

      const unclear = await createPhrase(request, `Unclear ${Date.now()}`, {
        key: 'bluesy A',
      });
      await page.goto(`/phrases/${unclear.id}`);
      await expect(page.getByTestId('note-facts')).toContainText(
        'Key "bluesy A" was not understood',
      );
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
