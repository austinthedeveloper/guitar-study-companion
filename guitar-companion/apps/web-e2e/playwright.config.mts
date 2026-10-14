import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const port = Number(process.env['E2E_WEB_PORT'] ?? 4280);
const baseURL = process.env['BASE_URL'] || `http://localhost:${port}`;
const allBrowsers = process.env['E2E_ALL_BROWSERS'] === '1';

/**
 * Whole-site e2e against the full stack (see docs/TESTING.md#e2e-strategy).
 * Set BASE_URL to run against a deployed environment instead (smoke tests).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [
    [process.env['CI'] ? 'github' : 'list'],
    [
      'html',
      {
        outputFolder: '../../dist/.playwright/apps/web-e2e/playwright-report',
        open: 'never',
      },
    ],
    ['./src/support/route-coverage-reporter.ts'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: process.env['BASE_URL']
    ? undefined
    : {
        command: 'node tools/e2e/start-stack.mjs',
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env['CI'],
        timeout: 180_000,
        cwd: workspaceRoot,
        stdout: 'ignore',
        stderr: 'pipe',
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(allBrowsers
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
