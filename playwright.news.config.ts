import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const NEWS_PORT = 4331;

export default defineConfig({
  testDir: './tests',
  testMatch: 'news.spec.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${NEWS_PORT}`,
    url: `http://127.0.0.1:${NEWS_PORT}/news/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${NEWS_PORT}`,
    browserName: 'chromium',
    launchOptions: existsSync(chromePath) ? { executablePath: chromePath } : {},
  },
});
