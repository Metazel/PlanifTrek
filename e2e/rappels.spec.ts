import { expect, test } from './fixtures';

test.describe('Rappels « à ne pas oublier »', () => {
  test('rendez-vous avec un guide : contact appelable, agenda ; vol : heure à laquelle partir', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    const panel = page.getByRole('region', { name: '⭐ À ne pas oublier' });
    await expect(panel).toContainText('Cochez « À ne pas oublier »');

    const jer = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Jérusalem/ }) }).first();
    await page.getByRole('button', { name: 'Modifier Mur occidental' }).click();
    await jer.getByLabel('Heure (facultatif)').fill('09:30');
    await jer.getByLabel(/À ne pas oublier/).check();
    await jer.getByLabel('Contact (facultatif)').fill('Yossi');
    await jer.getByLabel('Téléphone du contact').fill('javascript:alert(1)');
    await jer.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(jer.getByRole('alert')).toContainText('Numéro invalide');
    await jer.getByLabel('Téléphone du contact').fill('+972 50 123 4567');
    await jer.getByRole('button', { name: 'Enregistrer', exact: true }).click();

    await expect(panel).toContainText('Mur occidental');
    await expect(panel.getByRole('link', { name: '📞 Appeler Yossi' })).toHaveAttribute('href', 'tel:+972501234567');
    const cal = panel.getByRole('link', { name: /Google Agenda : Mur occidental/ });
    await expect(cal).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
    await expect(cal).toHaveAttribute('rel', 'noopener noreferrer');

    // Le train réservé de Jérusalem : marqué à ne pas oublier, délais saisis.
    await jer.getByRole('button', { name: 'Modifier le trajet' }).click();
    await jer.getByLabel(/À ne pas oublier \(rappel du départ/).check();
    await jer.getByLabel('Enregistrement avant le départ').fill('20');
    await jer.getByLabel('Route jusqu’au départ').fill('25');
    await jer.getByRole('button', { name: 'Enregistrer le trajet' }).click();
    await expect(jer).toContainText('⏰ Partir à 09:30');
    await expect(panel).toContainText('Partir pour');

    const download = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Tout ajouter à l’agenda (.ics)' }).click();
    expect((await download).suggestedFilename()).toBe('planiftrek-rappels.ics');
  });
});
