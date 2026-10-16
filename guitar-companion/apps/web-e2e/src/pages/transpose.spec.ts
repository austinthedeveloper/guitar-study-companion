import { expect, test } from '@playwright/test';
import { CreatePhraseRequest } from '@gsc/contracts';
import { ROUTE_PATHS, routeTag } from '@gsc/web/routes';
import { expectNoA11yViolations } from '../support/a11y';
import { createPhrase } from '../support/api';
import { audioLog, stubAudio } from '../support/audio-stub';

type Events = CreatePhraseRequest['events'];
const note = (
  id: string,
  order: number,
  stringIndex: number,
  fret: number | null,
  techniques: Events[number]['techniques'] = [],
  bendSemitones?: number,
): Events[number] => ({
  id,
  order,
  stringIndex,
  fret,
  durationTicks: null,
  techniques,
  ...(bendSemitones ? { bendSemitones } : {}),
});
// A7 -> D7 blues lick: C4 C#4(h) E4 G4->A4 A4 | F#4 D4~
const blues: Events = [
  note('e1', 0, 2, 5),
  note('e2', 1, 2, 6, ['hammer-on']),
  note('e3', 2, 1, 5),
  note('e4', 3, 1, 8, ['bend'], 2),
  note('e5', 4, 0, 5),
  note('e6', 5, 1, 7),
  note('e7', 6, 2, 7, ['vibrato']),
];
const bluesContext = {
  key: 'A',
  chords: 'A7 D7',
  chordChanges: [
    { fromOrder: 0, chord: 'A7' },
    { fromOrder: 5, chord: 'D7' },
  ],
};

test.describe(
  'Transpose page',
  { tag: routeTag(ROUTE_PATHS.transpose) },
  () => {
    test.beforeEach(async ({ page }) => {
      await stubAudio(page);
    });

    test('moves a lick to a new key, keeping shape and every note’s role', async ({
      page,
      request,
    }) => {
      const phrase = await createPhrase(
        request,
        `Blues ${Date.now()}`,
        bluesContext,
        blues,
      );
      await page.goto(`/phrases/${phrase.id}`);
      await page.getByTestId('transpose-link').click();
      await expect(page).toHaveURL(`/phrases/${phrase.id}/transpose`);
      await expect(page.getByTestId('transpose-from')).toHaveValue('A');
      await expect(page.getByTestId('transpose-hint')).toContainText(
        'key to move it to',
      );

      await page.getByTestId('transpose-to').fill('C');
      await expect(page.getByTestId('transposed-heading')).toHaveText(
        'In C major (up 3 semitones)',
      );
      // Same shape three frets up; chords moved with it.
      const tab = page.getByTestId('transposed-tab');
      await expect(tab.getByTestId('cell-0-2')).toHaveText('8');
      await expect(tab.getByTestId('cell-3-1')).toHaveText('11');
      await expect(tab.getByTestId('tab-chord-0')).toHaveText('C7');
      await expect(tab.getByTestId('tab-chord-5')).toHaveText('F7');
      const first = page.getByTestId('compare-row').first();
      await expect(first).toContainText('C4 (b3 of A7)');
      await expect(first).toContainText('Eb4 (b3 of C7)');
      await expect(page.getByTestId('transpose-issues')).toHaveCount(0);

      // Open position within fret 12 still validates.
      await page
        .getByTestId('transpose-position')
        .selectOption({ label: 'Open position (frets 0–4)' });
      await page.getByTestId('transpose-max-fret').selectOption('12');
      await expect(page.getByTestId('transpose-issues')).toHaveCount(0);
      await expect(page.getByTestId('transpose-problem')).toHaveCount(0);

      await page.getByTestId('play-transposed').click();
      expect(
        (await audioLog(page)).filter((l) => l.startsWith('note')),
      ).toHaveLength(7);
      await expectNoA11yViolations(page);
    });

    test('offers two controlled variations and applies them over a progression', async ({
      page,
      request,
    }) => {
      const phrase = await createPhrase(
        request,
        `Vary ${Date.now()}`,
        bluesContext,
        blues,
      );
      await page.goto(`/phrases/${phrase.id}/transpose`);
      await page.getByTestId('transpose-to').fill('C');

      const variations = page.getByTestId('variation');
      await expect(variations.getByTestId('exercise-title')).toHaveText([
        'Hold the targets',
        'Resolve to the 3rd of F7',
      ]);
      await expect(variations.nth(1)).toContainText(
        'Ends on A4 (3 of F7) instead of F4.',
      );
      await expect(variations.first().getByTestId('exercise-done')).toHaveCount(
        0,
      );

      await expect(page.getByTestId('apply-progression')).toHaveValue('C7 F7');
      await expect(page.getByTestId('application-fit')).toHaveText([
        'Over C7: 4 of 7 notes are chord tones.',
        'Over F7: 5 of 7 notes are chord tones.',
      ]);
      await page.getByTestId('apply-progression').fill('C7 G7');
      await expect(page.getByTestId('application-fit').nth(1)).toHaveText(
        'Over G7: 2 of 7 notes are chord tones.',
      );
      await page.getByTestId('application').nth(1).getByTestId('play').click();
      await expect(
        page.getByTestId('application').nth(1).getByTestId('stop'),
      ).toBeVisible();
    });

    test('saves the transposed version as a new phrase that remembers its origin', async ({
      page,
      request,
    }) => {
      const title = `Origin ${Date.now()}`;
      const phrase = await createPhrase(request, title, bluesContext, blues);
      await page.goto(`/phrases/${phrase.id}/transpose`);
      await page.getByTestId('transpose-to').fill('C');
      await page.getByTestId('save-transposed').click();
      await expect(page.getByTestId('phrase-heading')).toHaveText(
        `${title} (in C major)`,
      );
      await expect(page.getByTestId('phrase-origin')).toContainText(
        'Transposed to C major from',
      );
      await expect(page.getByTestId('cell-0-2')).toHaveText('8');
      await expect(page.getByTestId('harmony-key')).toHaveValue('C');
      await expect(page.getByTestId('harmony-chords')).toHaveValue('C7 F7');
      await page.getByTestId('phrase-derived-from').click();
      await expect(page).toHaveURL(`/phrases/${phrase.id}`);
    });

    test('explains when no fingering exists, and when keys are not understood', async ({
      page,
      request,
    }) => {
      const low = await createPhrase(
        request,
        `Low ${Date.now()}`,
        { key: 'E' },
        [note('a', 0, 5, 0), note('b', 1, 5, 3)],
      );
      await page.goto(`/phrases/${low.id}/transpose`);
      await page.getByTestId('transpose-to').fill('Eb');
      await page.getByTestId('transpose-octave').selectOption('down');
      await expect(page.getByTestId('transpose-problem')).toContainText(
        "Note 1 (E2 moved by -1 semitones) can't be played",
      );
      await page.getByTestId('transpose-to').fill('H');
      await expect(page.getByTestId('transpose-hint')).toContainText(
        `"H" isn't a key this app understands.`,
      );
      await page.goto('/phrases/000000000000000000000000/transpose');
      await expect(page.getByTestId('transpose-not-found')).toBeVisible();
    });
  },
);
