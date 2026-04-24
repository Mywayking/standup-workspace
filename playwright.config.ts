import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['frontend-e2e.spec.ts', 'write-page.spec.ts', 'write-smoke.spec.ts', 'mobile-e2e.spec.ts'],
  timeout: 60000,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    baseURL: 'https://ai.alwayshaha.art',
  },
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
});
