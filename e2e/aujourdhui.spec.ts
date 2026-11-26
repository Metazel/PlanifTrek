import { expect, test } from './fixtures';

test('vue Aujourd’hui et exports', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
  await page.getByRole('button', { name: "Charger l'exemple" }).click();
  await page.getByRole('button', { name: '☀ Aujourd’hui' }).click();
  await expect(page.getByText('Aperçu : le voyage n’a pas lieu aujourd’hui.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /10 août/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jour précédent' })).toBeDisabled();
  await page.getByRole('button', { name: 'Jour suivant' }).click();
  const prog = page.getByRole('list', { name: 'Programme de la journée' });
  await expect(prog).toContainText('Mur occidental');
  await expect(page.getByText('🛏 Ce soir : Hôtel à Jérusalem')).toBeVisible();
  await page.getByRole('button', { name: 'Jour suivant' }).click();
  await page.getByRole('button', { name: 'Jour suivant' }).click();
  await expect(prog.getByRole('listitem')).toHaveText([/09:55.*Partir pour Gare Yitzhak Navon/, /10:15.*Départ vers Netanya/, /11:40.*Arrivée de Jérusalem/]);

  await page.getByRole('button', { name: '✎ Détail & carte' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /KML/ }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('planiftrek-israel-aout-exemple.kml');
});
