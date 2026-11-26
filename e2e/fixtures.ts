import { test as base, expect } from '@playwright/test';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const STYLE = { version: 8, sources: {}, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#e5e7eb' } }] };

/** La recette n'appelle jamais les vrais services de cartes : réponses simulées. */
export const test = base.extend<{ offlineMaps: undefined }>({
  offlineMaps: [
    async ({ context }, use) => {
      // Au niveau du contexte : intercepte aussi les requêtes du service worker.
      await context.route('https://tiles.openfreemap.org/styles/**', (r) => r.fulfill({ json: STYLE }));
      await context.route('https://tiles.openfreemap.org/**', (r) => r.abort());
      await context.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ body: PNG, contentType: 'image/png' }));
      await use(undefined);
    },
    { auto: true },
  ],
});
export { expect };
