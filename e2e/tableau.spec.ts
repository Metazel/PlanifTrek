import { expect, test } from './fixtures';

test.describe('Tableau du voyage', () => {
  test('synthèse, saisie rapide sur la ligne du jour, hébergement en une ligne, étape placée automatiquement', async ({ page, context }) => {
    await context.route('https://nominatim.openstreetmap.org/**', (r) =>
      r.fulfill({ json: [{ lat: '31.559', lon: '35.4732', name: 'Mer Morte', display_name: 'Mer Morte, Israël', address: { country_code: 'il' } }] }),
    );
    await page.goto('./');
    await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
    await page.getByRole('button', { name: "Charger l'exemple" }).click();

    const syn = page.getByRole('region', { name: /10 août → 19 août · 10 jours · 3 étapes/ });
    await expect(syn).toContainText('✓ Nuits 9/9');
    await expect(syn).toContainText('✓ Trajets réservés 2/2');
    await expect(syn).toContainText('✓ Aucune incohérence');

    const rows = page.getByRole('list', { name: 'Tableau du voyage, un jour par ligne' }).locator(':scope > li');
    await expect(rows).toHaveCount(10);
    const first = rows.first();
    await first.getByLabel(/Ajouter au programme du 10 août/).fill('15:25 Débarquement TLV');
    await first.getByLabel(/Ajouter au programme du 10 août/).press('Enter');
    await expect(first).toContainText('15:25');
    await expect(first).toContainText('Débarquement TLV');

    // Nouvelle étape en une ligne : 2 nuits après Eilat, placée sur la carte automatiquement.
    const add = page.getByRole('region', { name: 'Ajouter une étape' });
    await add.getByLabel('Lieu').fill('Mer Morte');
    await add.getByRole('button', { name: 'Ajouter' }).click();
    await expect(add.getByRole('status')).toContainText('📍 « Mer Morte » placé : Mer Morte, Israël');
    await expect(rows).toHaveCount(12);
    await expect(syn.or(page.getByRole('region', { name: /12 jours · 4 étapes/ }))).toContainText('⚠ Nuits 9/11');

    // Hébergement en une ligne depuis le tableau.
    const night = rows.nth(9);
    await night.getByRole('button', { name: '⚠ à prévoir — ajouter' }).click();
    await night.getByLabel(/Hébergement du 19 août/).fill('Hôtel Ein Bokek');
    await night.getByLabel(/Hébergement du 19 août/).press('Enter');
    await expect(night).toContainText('🛏 Hôtel Ein Bokek');
    await expect(page.getByRole('region', { name: /12 jours/ })).toContainText('✓ Nuits 11/11');
  });
});
