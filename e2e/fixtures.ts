import { test as base, expect } from '@playwright/test';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const STYLE = { version: 8, sources: {}, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#e5e7eb' } }] };

/** La recette n'appelle jamais les vrais services de cartes : réponses simulées. */
export const test = base.extend<{ offlineMaps: undefined }>({
  offlineMaps: [
    async ({ page }, use) => {
      await page.route('https://tiles.openfreemap.org/styles/**', (r) => r.fulfill({ json: STYLE }));
      await page.route('https://tiles.openfreemap.org/**', (r) => r.abort());
      await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ body: PNG, contentType: 'image/png' }));
      await use(undefined);
    },
    { auto: true },
  ],
});
export { expect };
