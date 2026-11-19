import { Page } from '@playwright/test';

export type StudyTab = 'notes' | 'why' | 'scales' | 'library';

/** Phrase detail keeps its study sections behind tabs; open one. */
export async function openStudyTab(page: Page, tab: StudyTab): Promise<void> {
  await page.getByTestId(`study-tab-${tab}`).click();
}
