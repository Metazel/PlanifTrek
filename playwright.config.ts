import { defineConfig, devices } from '@playwright/test';

/** Recette navigateur : build de production servi localement (CSP active). */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/planiftrek/',
    trace: 'retain-on-failure',
    // Poste local sans téléchargement de navigateur : PW_CHROME=/chemin/vers/chrome
    ...(process.env.PW_CHROME ? { launchOptions: { executablePath: process.env.PW_CHROME } } : {}),
  },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/planiftrek/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
