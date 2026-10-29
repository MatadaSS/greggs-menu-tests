import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 2, // a live public site can be flaky; retries separate flakes from real failures
  workers: 1, // one browser at a time: kinder to a production site and avoids load-induced timeouts
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  outputDir: 'reports/artifacts',
  use: {
    baseURL: 'https://www.greggs.com',
    locale: 'en-GB',
    actionTimeout: 15_000, // fail fast with the exact step named instead of an opaque 60s test timeout
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // iPad-sized screen (portrait). Uses Chromium so no extra browser install is needed.
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true } },
  ],
});
