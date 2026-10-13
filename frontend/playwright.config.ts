import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: './test-results/e2e',
  use: {
    baseURL: 'http://localhost:5181',
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'bash ../scripts/e2e-server.sh', url: 'http://localhost:8081/api/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'API_PROXY_TARGET=http://localhost:8081 npm run dev -- --port 5181 --strictPort', url: 'http://localhost:5181', reuseExistingServer: false },
  ],
});
