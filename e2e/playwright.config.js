const path = require('path');
const { defineConfig } = require('@playwright/test');

const releaseLabel = (process.env.PLAYWRIGHT_RELEASE_LABEL || '').trim();
const baseURL = (process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:5173').trim();
const skipGlobalSetup = process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP === '1';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const outputDir = releaseLabel
  ? path.join('./artifacts', 'release', releaseLabel, 'test-results')
  : './artifacts/test-results';

module.exports = defineConfig({
  testDir: './tests',
  outputDir,
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  globalSetup: skipGlobalSetup ? undefined : './global-setup.js',
  globalTeardown: skipGlobalSetup ? undefined : './global-teardown.js',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true
  },
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: 'cd ../backend && npm run db:seed && npm run dev',
          url: 'http://127.0.0.1:3001/api/health',
          reuseExistingServer: false,
          timeout: 30000,
          env: {
            NODE_ENV: 'test' // Disable rate limiting for E2E tests
          }
        },
        {
          command: 'cd ../frontend && npm run dev -- --host 127.0.0.1',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: false,
          timeout: 30000
        }
      ]
});
