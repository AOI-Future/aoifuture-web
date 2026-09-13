import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './tests', testMatch: 'afterhours.spec.ts', workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4328', launchOptions: existsSync(chrome) ? { executablePath: chrome } : {} },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4328', url: 'http://127.0.0.1:4328/play/afterhours', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], defaultBrowserType: 'chromium' } },
  ],
});
