import { defineConfig, devices } from '@playwright/test';

const PORT = 4331;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  webServer: {
    // --ignore-lock keeps astro preview in the foreground so Playwright owns and stops it.
    command: `npm run build && npm run preview -- --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 820 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
