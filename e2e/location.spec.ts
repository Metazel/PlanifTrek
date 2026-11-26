import { expect, test } from './fixtures';

test('location de véhicule : saisie, planning, rappels ; retour avant prise refusé', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
  await page.getByRole('button', { name: "Charger l'exemple" }).click();
  await page.getByRole('button', { name: '✎ Détail & carte' }).click();
  const sec = page.getByRole('region', { name: '🚙 Véhicules de location' });
  await sec.getByRole('button', { name: '+ Location' }).click();
  await sec.getByLabel('Agence (loueur)').fill('Hertz');
  await sec.getByLabel('Type de véhicule').fill('Citadine');
  await sec.getByLabel('Lieu de prise').fill('Gare Yitzhak Navon');
  await sec.getByLabel(/^Prise le/).fill('2027-08-11T09:00');
  await sec.getByLabel('Lieu de retour').fill('Netanya centre');
  await sec.getByLabel(/^Retour le/).fill('2027-08-10T09:00');
  await sec.getByRole('button', { name: 'Enregistrer la location' }).click();
  await expect(sec.getByRole('alert')).toContainText('Le retour doit être après la prise');
  await sec.getByLabel(/^Retour le/).fill('2027-08-14T18:00');
  await sec.getByRole('button', { name: 'Enregistrer la location' }).click();

  await expect(sec).toContainText('Hertz · Citadine');
  await expect(page.getByRole('region', { name: 'Jérusalem, mer. 11 août' })).toContainText('Prise du véhicule — Hertz');
  await expect(page.getByRole('region', { name: 'Netanya, sam. 14 août' })).toContainText('Retour du véhicule — Hertz');
  const rem = page.getByRole('region', { name: '⭐ À ne pas oublier' });
  await expect(rem).toContainText('Prendre le véhicule (Citadine) — Hertz');
  await expect(rem).toContainText('Rendre le véhicule (Citadine) — Hertz');

  await page.reload();
  await page.getByRole('button', { name: /Israël — août/ }).click();
  await page.getByRole('button', { name: '✎ Détail & carte' }).click();
  await expect(page.getByRole('region', { name: '🚙 Véhicules de location' })).toContainText('Hertz · Citadine');
});
