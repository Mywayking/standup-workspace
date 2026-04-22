import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['frontend-e2e.spec.ts', 'write-page.spec.ts'],
  timeout: 60000,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    baseURL: 'https://ai.alwayshaha.art',
  },
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
