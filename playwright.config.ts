import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: true, workers: 3,
  timeout: 45000, expect: { timeout: 8000 },
  use: { baseURL: 'http://localhost:5180', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5180 --strictPort', url: 'http://localhost:5180', reuseExistingServer: !process.env.CI },
});
