// @ts-check
import { devices } from '@playwright/test';

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default {
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3056',
    trace: 'on-first-retry',
    headless: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
};


