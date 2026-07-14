import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  webServer: {
    command: 'CONSULTATION_NATIVE_FORM_ENABLED=true CONSULTATION_ALLOWED_ORIGINS=http://127.0.0.1:4327 npm run dev -- --host 127.0.0.1 --port 4327',
    url: 'http://127.0.0.1:4327/consulting/intake',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4327',
    browserName: 'chromium',
    launchOptions: existsSync(chromePath) ? { executablePath: chromePath } : {},
  },
});
