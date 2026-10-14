import { expect, Page } from '@playwright/test';
import { join } from 'node:path';

export const SYNTHETIC = join(__dirname, '../../../../fixtures/synthetic');
export const fixture = (name: string) => join(SYNTHETIC, name);

/** Routes interpret calls through the real API with a fake-provider scenario (E2E_MODE only). */
export async function useFakeScenario(
  page: Page,
  scenario: string,
): Promise<void> {
  await page.unroute('**/api/imports/interpret');
  await page.route('**/api/imports/interpret', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-gsc-fake-scenario': scenario,
      },
    }),
  );
}

/** Counts interpret requests that reach the network. */
export function countInterpretRequests(page: Page): () => number {
  let count = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/imports/interpret')) count++;
  });
  return () => count;
}

export async function upload(page: Page, file: string): Promise<void> {
  await page.getByTestId('file-input').setInputFiles(fixture(file));
  await expect(page.getByTestId('step-select')).toBeVisible();
}

/** Drags a selection between two fractional points of the page image. */
export async function dragSelect(
  page: Page,
  from: [number, number],
  to: [number, number],
): Promise<void> {
  const box = await page.getByTestId('cropper-canvas').boundingBox();
  if (!box) throw new Error('canvas not visible');
  await page.mouse.move(
    box.x + box.width * from[0],
    box.y + box.height * from[1],
  );
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], {
    steps: 5,
  });
  await page.mouse.up();
}

export async function selectPassage(page: Page): Promise<void> {
  await dragSelect(page, [0.04, 0.4], [0.97, 0.9]);
  await expect(page.getByTestId('selection-box')).toBeVisible();
  await page.getByTestId('selection-next').click();
  await expect(page.getByTestId('step-details')).toBeVisible();
}

export async function fillDetails(
  page: Page,
  book = 'E2E Test Book',
): Promise<void> {
  await page.getByTestId('book-title').fill(book);
  await page.getByTestId('song-title').fill('Synthetic Song');
  await page.getByTestId('page').fill('12');
}

export async function recognize(page: Page): Promise<void> {
  await page.getByTestId('recognize').click();
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  await page.getByTestId('consent-confirm').click();
}

/** Upload → select → details → consent → review, using the given scenario. */
export async function reachReview(
  page: Page,
  scenario = 'default',
  file = 'synthetic-lick.png',
): Promise<void> {
  await useFakeScenario(page, scenario);
  await page.goto('/import');
  await upload(page, file);
  await selectPassage(page);
  await fillDetails(page);
  await recognize(page);
  await expect(page.getByTestId('step-review')).toBeVisible();
}
