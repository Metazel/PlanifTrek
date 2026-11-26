import { expect, test } from './fixtures';

const STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sprite: 'https://tiles.openfreemap.org/sprites/ofm',
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [
    { id: 'fond', type: 'background', paint: { 'background-color': '#e5e7eb' } },
    { id: 'noms', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'] } },
  ],
};

test('hors ligne : pack carte téléchargé, application et voyage disponibles sans réseau', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'android', 'scénario mobile');
  let tileCalls = 0;
  await context.route('https://tiles.openfreemap.org/styles/**', (r) => r.fulfill({ json: STYLE }));
  await context.route('https://tiles.openfreemap.org/planet', (r) => r.fulfill({ json: { tiles: ['https://tiles.openfreemap.org/planet/v1/{z}/{x}/{y}.pbf'], maxzoom: 14 } }));
  await context.route('https://tiles.openfreemap.org/planet/v1/**', (r) => {
    tileCalls++;
    return r.fulfill({ body: Buffer.alloc(64), contentType: 'application/x-protobuf' });
  });
  await context.route(/tiles\.openfreemap\.org\/(fonts|sprites)\//, (r) => r.fulfill({ body: Buffer.alloc(16) }));

  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
  await page.getByRole('button', { name: "Charger l'exemple" }).click();
  await page.getByRole('button', { name: 'Afficher la carte' }).click();
  await page.getByRole('button', { name: 'Télécharger la carte du voyage' }).click();
  await expect(page.getByText(/✓ Pack prêt : \d+ tuiles/)).toBeVisible({ timeout: 60_000 });
  expect(tileCalls).toBeGreaterThan(100);
  expect(tileCalls).toBeLessThanOrEqual(3000);
  const cached = await page.evaluate(async () => (await (await caches.open('pt-pack')).keys()).length);
  expect(cached).toBeGreaterThan(tileCalls);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'PlanifTrek' })).toBeVisible();
  await page.getByRole('button', { name: /Israël — août \(exemple\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Étapes' })).toBeVisible();
  await page.getByRole('button', { name: 'Afficher la carte' }).click();
  await expect(page.getByText(/✓ Pack prêt/)).toBeVisible();
  // Une tuile du pack est servie sans réseau par le service worker.
  const served = await page.evaluate(async () => (await fetch('https://tiles.openfreemap.org/planet/v1/0/0/0.pbf')).ok);
  expect(served).toBe(true);
  await context.setOffline(false);
});
