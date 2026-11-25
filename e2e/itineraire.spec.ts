import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

async function start(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
}

async function addStop(page: Page, name: string, arrival: string, departure: string) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ajouter l’étape' }) });
  await form.getByLabel(/Nom de l’étape/).fill(name);
  await form.getByLabel('Arrivée', { exact: true }).fill(arrival);
  await form.getByLabel('Départ', { exact: true }).fill(departure);
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
    const controls = page.getByRole('region', { name: 'Contrôles' });
    await expect(controls.getByText(/sans hébergement/)).toHaveCount(6);

    // Aide : le bouton de l'étape pré-remplit l'hébergement sur les nuits manquantes.
    const jer = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Jérusalem/ }) });
    await expect(jer).toContainText('3 nuits sans hébergement');
    await jer.getByRole('button', { name: 'Ajouter un hébergement' }).click();
    await expect(jer.getByLabel('Type')).toHaveValue('hebergement');
    await jer.getByLabel('Titre').fill('Hôtel King David');
    await jer.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await expect(controls.getByText(/sans hébergement/)).toHaveCount(3);

    await page.reload();
    await page.getByRole('button', { name: /Israël 2027/ }).click();
    expect(await stopNames(page)).toEqual(['1.Jérusalem', '2.Netanya']);
    await expect(page.getByText('Hôtel King David')).toBeVisible();
  });

  test('refuse une saisie invalide avec un message lié au champ', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Créer' }).click();
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ajouter l’étape' }) });
    await form.getByLabel('Arrivée', { exact: true }).fill('2027-08-13');
    await form.getByLabel('Départ', { exact: true }).fill('2027-08-10');
    await form.getByRole('button', { name: 'Ajouter l’étape' }).click();
    await expect(page.getByRole('alert')).toContainText('Indiquez le nom');
    await expect(page.getByRole('alert')).toContainText('Le départ doit être');
    await expect(form.getByLabel(/Nom de l’étape/)).toHaveAttribute('aria-invalid', 'true');
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
    // Le dîner (non réservé) suit Netanya ; aucune alerte à son sujet.
    await expect(
      page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Netanya/ }) }).first(),
    ).toContainText('Dîner chez les cousins');
    await expect(page.getByText('« Dîner chez les cousins » est hors des dates')).toHaveCount(0);

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

  test('étape de passage sans nuit, puis +/- nuits sur une étape', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    await page.getByRole('button', { name: '+ Ajouter une étape' }).click();
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ajouter l’étape' }) });
    await form.getByLabel('🚏 Passage (sans nuit)').check();
    await expect(form.getByLabel('Départ', { exact: true })).toHaveCount(0);
    await form.getByLabel('Nom de l’étape').fill('Aéroport Ramon');
    await form.getByLabel('Heure d’arrivée (facultatif)').fill('10:30');
    await form.getByRole('button', { name: 'Ajouter l’étape' }).click();
    await expect(page.getByText(/Passage le 19 août · arrivée 10:30/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Contrôles' })).toContainText('Aucune incohérence');

    await page.getByRole('button', { name: 'Une nuit de plus à Jérusalem' }).click();
    await expect(page.getByText('10 août → 14 août · 5 jour(s), 4 nuits')).toBeVisible();
    await expect(page.getByText('14 août → 17 août · 4 jour(s), 3 nuits')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect(page.getByText('10 août → 13 août · 4 jour(s), 3 nuits').first()).toBeVisible();
  });

  test('sous-étapes : ordre dans la journée et transfert vers une autre étape', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    const jer = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Jérusalem/ }) });
    await jer.getByRole('button', { name: '+ Sous-étape' }).click();
    await jer.getByLabel('Type').selectOption('repas');
    await jer.getByLabel('Titre').fill('Brunch');
    await jer.getByLabel('Jour').selectOption('2027-08-11');
    await jer.getByLabel('Heure (facultatif)').fill('10:00');
    await jer.getByRole('button', { name: 'Ajouter', exact: true }).click();

    const day = page.getByRole('region', { name: /Jérusalem, mer\. 11 août/ });
    await expect(day.getByRole('listitem')).toHaveText([/Mur occidental/, /10:00\s*Brunch/]);
    await day.getByRole('button', { name: 'Monter Brunch' }).click();
    await expect(day.getByRole('listitem')).toHaveText([/Brunch/, /Mur occidental/]);

    await day.getByLabel('Transférer Brunch vers une autre étape').selectOption({ label: 'Netanya' });
    await expect(day.getByRole('listitem')).toHaveText([/Mur occidental/]);
    const net = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Netanya/ }) });
    await expect(net).toContainText('Brunch');
  });

  test('aide à la saisie : recherche de lieu (service simulé), puis panne gérée', async ({ page }) => {
    let calls = 0;
    await page.route('https://nominatim.openstreetmap.org/**', (route) => {
      calls++;
      return calls === 1
        ? route.fulfill({
            json: [
              { lat: '31.7788', lon: '35.2257', name: 'Jérusalem', display_name: 'Jérusalem, District de Jérusalem, Israël', address: { country_code: 'il' } },
              { lat: '38.1', lon: '-89.6', name: 'Jerusalem', display_name: 'Jerusalem, Illinois, États-Unis', address: { country_code: 'us' } },
            ],
          })
        : route.fulfill({ status: 503, body: 'indisponible' });
    });
    await start(page);
    await page.getByRole('button', { name: 'Créer' }).click();
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Ajouter l’étape' }) });
    await form.getByLabel('Fuseau horaire').selectOption('Europe/Paris');
    await form.getByLabel('Nom de l’étape').fill('jerusalem');
    await form.getByRole('button', { name: 'Chercher' }).click();
    // Valider sans choisir : l'appli demande de choisir.
    await form.getByRole('button', { name: 'Ajouter l’étape' }).click();
    await expect(form.getByRole('alert')).toContainText('Choisissez un lieu dans la liste');
    await expect(form.getByText('Choisissez le lieu correspondant :')).toBeVisible();
    await form.getByRole('button', { name: /Jérusalem, District/ }).click();
    await expect(form.getByLabel(/Nom de l’étape/)).toHaveValue('Jérusalem');
    await expect(form.getByLabel('Fuseau horaire')).toHaveValue('Asia/Jerusalem');
    await expect(form).toContainText('placé sur la carte');

    await form.getByLabel(/Nom de l’étape/).fill('Eilat');
    await form.getByRole('button', { name: 'Chercher' }).click();
    await expect(form.getByRole('alert')).toContainText('Saisissez le nom à la main');
    // Étape famille : aucune recherche en ligne proposée.
    await form.getByLabel('👪 Visite famille').check();
    await expect(form.getByRole('button', { name: 'Chercher' })).toHaveCount(0);
  });

  test('hébergement plus long que l’étape : réajustement en un clic', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    await page.getByRole('button', { name: 'Une nuit de moins à Jérusalem' }).click();
    const jer = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Jérusalem/ }) }).first();
    await expect(jer).toContainText('Dates différentes de l’étape');
    await jer.getByRole('button', { name: 'Ajuster l’étape à l’hébergement' }).click();
    await expect(jer).toContainText('10 août → 13 août · 4 jour(s), 3 nuits');
    await expect(jer).not.toContainText('Dates différentes');
  });

  test('éditeur sans anomalie d’accessibilité critique ou sérieuse', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});
