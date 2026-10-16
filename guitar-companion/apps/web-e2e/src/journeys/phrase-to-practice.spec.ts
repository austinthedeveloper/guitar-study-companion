import { expect, test } from '@playwright/test';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import { stubAudio } from '../support/audio-stub';
import { reachReview } from '../support/import-flow';

test.describe(
  'Journey: scanned passage → practice plan → tracked progress',
  {
    tag: [
      routeTag(ROUTE_PATHS.import),
      routeTag(ROUTE_PATHS.phrase),
      routeTag(ROUTE_PATHS.practice),
    ],
  },
  () => {
    test('build a plan, practise with playback, complete it, and keep progress', async ({
      page,
    }) => {
      await stubAudio(page);
      await page.clock.install();

      // Import the fake draft (D5 bent to E5 ... A4+D5) and save it.
      await reachReview(page);
      await page
        .getByTestId('phrase-title')
        .fill(`Practice journey ${Date.now()}`);
      await page.getByTestId('save-phrase').click();
      await expect(page.getByTestId('phrase-heading')).toBeVisible();

      // One chord: assumed under the whole phrase, enabling "apply".
      await page.getByTestId('harmony-chords').fill('A7');
      await page.getByTestId('harmony-save').click();
      await expect(page.getByTestId('harmony-dirty')).toHaveCount(0);

      await page.getByTestId('practice-link').click();
      await page.getByTestId('plan-minutes').selectOption('30');
      await page.getByTestId('plan-build').click();
      const exercises = page.getByTestId('exercise');
      await expect(exercises.first()).toBeVisible();
      const kinds = await page.getByTestId('exercise-kind').allTextContents();
      // isolate → technique → slow → apply, in that order.
      expect(kinds[0]).toBe('Isolate');
      expect(kinds).toContain('Technique');
      expect(kinds.indexOf('Slow practice')).toBeGreaterThan(
        kinds.lastIndexOf('Technique'),
      );
      expect(kinds.at(-1)).toBe('Over the chords');
      await expectNoA11yViolations(page);

      // Practise one with playback and the metronome.
      const first = exercises.first();
      await first.getByTestId('play').click();
      await page.clock.runFor(10_000);
      await expect(first.getByTestId('play')).toBeVisible();
      await first.getByTestId('metronome').click();
      await page.clock.runFor(2000);
      await first.getByTestId('metronome').click();

      // Complete everything, leave a note.
      const count = await exercises.count();
      for (let i = 0; i < count; i++)
        await exercises.nth(i).getByTestId('exercise-done').check();
      await expect(page.getByTestId('plan-progress')).toContainText(
        `${count} of ${count} done`,
      );
      await page.getByTestId('session-notes').fill('Bends need work.');
      await page.getByTestId('session-notes').blur();
      await expect(page.getByTestId('plan-progress')).toContainText('Saved');

      // Progress persists across reload.
      await page.reload();
      await expect(page.getByTestId('plan-progress')).toContainText(
        `${count} of ${count} done`,
      );
      await expect(page.getByTestId('session-notes')).toHaveValue(
        'Bends need work.',
      );
    });
  },
);
