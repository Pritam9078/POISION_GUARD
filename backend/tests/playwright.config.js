import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright Test Configuration for PoisonGuard E2E Suite
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.js/,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // Run deterministically
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Avoid port & concurrency contention
  reporter: [
    ['list'],
    ['html', { outputFolder: './reports/html', open: 'never' }],
    ['json', { outputFile: './reports/test-results.json' }],
    ['junit', { outputFile: './reports/junit.xml' }],
  ],
  use: {
    baseURL: process.env.TEST_FRONTEND_URL || 'http://localhost:5173',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'laptop',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
    {
      name: 'admin-portal',
      use: {
        baseURL: process.env.TEST_ADMIN_URL || 'http://localhost:5174',
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /.*admin\/.*\.spec\.js/,
    },
  ],
})
