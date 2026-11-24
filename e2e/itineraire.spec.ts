import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function start(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
}

async function addStop(page: Page, name: string, arrival: string, departure: string) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ajouter l’étape' }) });
  await form.getByLabel('Nom de l’étape').fill(name);
  await form.getByLabel('Arrivée').fill(arrival);
  await form.getByLabel('Départ').fill(departure);
  await form.getByLabel('Fuseau horaire').selectOption('Asia/Jerusalem');
  await form.getByRole('button', { name: 'Ajouter l’étape' }).click();
}

const stopNames = (page: Page) => page.getByRole('list', { name: 'Étapes du voyage' }).getByRole('heading', { level: 3 }).allInnerTexts();

test.describe('Itinéraire (CU1, CU2, CU4)', () => {
  test('construire un voyage, être alerté des nuits sans hébergement, le retrouver après rechargement', async ({ page }) => {
    await start(page);
    await page.getByLabel('Nom du voyage').fill('Israël 2027');
    await page.getByRole('button', { name: 'Créer' }).click();

    await addStop(page, 'Jérusalem', '2027-08-10', '2027-08-13');
    await addStop(page, 'Netanya', '2027-08-13', '2027-08-16');
    await expect(page.getByText('4 jour(s), 3 nuits').first()).toBeVisible();
    await expect(page.getByText(/sans hébergement/)).toHaveCount(6);

    const jer = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Jérusalem/ }) });
    await jer.getByRole('button', { name: '+ Événement' }).click();
    await jer.getByLabel('Type').selectOption('hebergement');
    await jer.getByLabel('Titre').fill('Hôtel King David');
    await jer.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText(/sans hébergement/)).toHaveCount(3);

    await page.reload();
    await page.getByRole('button', { name: /Israël 2027/ }).click();
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Netanya']);
    await expect(page.getByText('Hôtel King David')).toBeVisible();
  });

  test('refuse une saisie invalide avec un message lié au champ', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Créer' }).click();
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ajouter l’étape' }) });
    await form.getByLabel('Arrivée').fill('2027-08-13');
    await form.getByLabel('Départ').fill('2027-08-10');
    await form.getByRole('button', { name: 'Ajouter l’étape' }).click();
    await expect(page.getByRole('alert')).toContainText('Indiquez le nom');
    await expect(page.getByRole('alert')).toContainText('Le départ doit être');
    await expect(form.getByLabel('Nom de l’étape')).toHaveAttribute('aria-invalid', 'true');
  });

  test('réorganiser au clavier : aperçu, application, annulation Ctrl+Z', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Netanya', '3.Eilat']);

    await page.getByRole('button', { name: 'Monter Eilat' }).click();
    const dialog = page.getByRole('dialog', { name: 'Réorganiser le circuit' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Jérusalem → Eilat → Netanya');
    await expect(dialog).toContainText('Trajet réservé devenu inutile');
    await expect(dialog).toContainText('Toutes les activités restent dans leur étape.');
    await new AxeBuilder({ page }).include('dialog').analyze().then(({ violations }) =>
      expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]),
    );

    await dialog.getByRole('button', { name: 'Appliquer' }).click();
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Eilat', '3.Netanya']);
    // L'activité reste à Netanya ; ses dates ayant glissé, une alerte la signale.
    await expect(
      page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Netanya/ }) }).first(),
    ).toContainText('Dîner chez les cousins');
    await expect(page.getByText('« Dîner chez les cousins » est hors des dates de Netanya.')).toBeVisible();

    await page.getByRole('heading', { name: 'Étapes' }).click();
    await page.keyboard.press('Control+z');
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Netanya', '3.Eilat']);
    await page.getByRole('button', { name: /Rétablir/ }).click();
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Eilat', '3.Netanya']);
  });

  test('glisser-déposer au clavier (Espace, flèche, Espace) ouvre l’aperçu ; Annuler ne change rien', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    await page.getByRole('button', { name: 'Déplacer Netanya' }).focus();
    // On attend chaque annonce destinée aux lecteurs d'écran avant la touche suivante.
    await page.keyboard.press('Space');
    await expect(page.getByText('Netanya saisie, position 2.')).toBeAttached();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByText('Netanya au-dessus de Jérusalem.')).toBeAttached();
    await page.keyboard.press('Space');
    const dialog = page.getByRole('dialog', { name: 'Réorganiser le circuit' });
    await expect(dialog).toContainText('Netanya → Jérusalem → Eilat');
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Netanya', '3.Eilat']);
  });

  test('fermer la boucle puis supprimer une étape après confirmation', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    await page.getByRole('button', { name: '⟲ Fermer la boucle' }).click();
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Netanya', '3.Eilat', '4.Jérusalem (retour)']);

    const net = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Netanya/ }) });
    await net.getByRole('button', { name: 'Supprimer l’étape' }).click();
    const dialog = page.getByRole('dialog', { name: /Supprimer Netanya/ });
    await expect(dialog).toContainText('2 événement(s) et 2 trajet(s) réservé(s)');
    await dialog.getByRole('button', { name: 'Supprimer' }).click();
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Eilat', '3.Jérusalem (retour)']);
    await expect(page.getByText(/jour\(s\) non planifié\(s\) entre Jérusalem et Eilat/)).toBeVisible();
  });

  test('éditeur sans anomalie d’accessibilité critique ou sérieuse', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});
