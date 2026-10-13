import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({ ...config, testMatch: '*-api.spec.ts', outputDir: './test-results/api' });
