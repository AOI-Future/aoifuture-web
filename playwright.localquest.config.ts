import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './tests', testMatch: ['localquest.spec.ts','localquest-live.spec.ts','localquest-entry.spec.ts'], workers: 1, timeout: 60000,
  outputDir: '.cache/localquest-playwright',
  use: { baseURL: 'http://127.0.0.1:4329', launchOptions: existsSync(chrome) ? { executablePath: chrome } : {} },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4329', url: 'http://127.0.0.1:4329/play/localquest', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], defaultBrowserType: 'chromium' } },
  ],
});
