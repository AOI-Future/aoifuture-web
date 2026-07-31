import baseConfig from './playwright.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...baseConfig,
  testMatch: /kumamoto-relief\.spec\.ts/,
  webServer: {
    command: 'CONSULTATION_NATIVE_FORM_ENABLED=false CONSULTATION_ALLOWED_ORIGINS=http://127.0.0.1:4328 npm run dev -- --host 127.0.0.1 --port 4328',
    url: 'http://127.0.0.1:4328/support/kumamoto-2026/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    ...baseConfig.use,
    baseURL: 'http://127.0.0.1:4328',
  },
  metadata: { consultationFlag: 'disabled' },
});