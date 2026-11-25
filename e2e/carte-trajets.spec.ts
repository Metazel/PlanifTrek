import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';


async function example(page: Page) {
  page.on('console', (m) => {
    if (m.type() === 'error' && /worker/i.test(m.text())) throw new Error(m.text());
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
  await page.getByRole('button', { name: "Charger l'exemple" }).click();
}

test.describe('Trajets (CU3) et carte', () => {
  test('trajet réservé affiché avec sa durée ; ajout et saisie d’un nouveau trajet', async ({ page }) => {
    await example(page);
    const jer = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Jérusalem/ }) }).first();
    await expect(jer).toContainText('10:15 – 11:40 (1 h 25)');
    await expect(jer).toContainText('Réservé');

    await page.getByRole('button', { name: '⟲ Fermer la boucle' }).click();
    const eil = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Eilat/ }) }).first();
    await expect(eil).toContainText('Trajet vers Jérusalem (retour) : non renseigné');
    await eil.getByRole('button', { name: '+ Trajet' }).click();
    await expect(eil).toContainText('À prévoir');
    await eil.getByRole('button', { name: 'Modifier le trajet' }).click();
    await eil.getByLabel('Mode').selectOption('bus');
    await eil.getByLabel(/^Départ le/).fill('2027-08-19T09:00');
    await eil.getByLabel(/^Arrivée le/).fill('2027-08-19T08:00');
    await eil.getByRole('button', { name: 'Enregistrer le trajet' }).click();
    await expect(eil.getByRole('alert')).toContainText('L’arrivée doit être après le départ');
    await eil.getByLabel(/^Arrivée le/).fill('2027-08-19T13:30');
    await eil.getByLabel('Prix').fill('42,5');
    await eil.getByLabel('Statut').selectOption('reserve');
    await eil.getByRole('button', { name: 'Enregistrer le trajet' }).click();
    await expect(eil).toContainText('09:00 – 13:30 (4 h 30)');
    await expect(eil).toContainText('42,50');
  });

  test('un vol devenu inutile après réorganisation apparaît « hors circuit » et peut être retiré', async ({ page }) => {
    await example(page);
    await page.getByRole('button', { name: 'Monter Eilat' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Appliquer' }).click();
    await expect(page.getByRole('region', { name: 'Contrôles' })).toContainText('ne correspond plus au circuit');
    const off = page.getByText('Trajets hors circuit').locator('..');
    await expect(off.getByRole('listitem')).toHaveCount(2);
    await off.getByRole('button', { name: 'Retirer' }).first().click();
    await expect(off.getByRole('listitem')).toHaveCount(1);
  });

  test('boucle : une seule épingle « 1 · 4 » marquée départ et arrivée', async ({ page }, info) => {
    await example(page);
    if (info.project.name === 'android') await page.getByRole('button', { name: 'Afficher la carte' }).click();
    await page.getByRole('button', { name: '⟲ Fermer la boucle' }).click();
    const markers = page.locator('.pt-marker');
    await expect(markers).toHaveCount(3, { timeout: 15_000 });
    await expect(markers.first()).toHaveText('1 · 4');
    await expect(markers.first()).toHaveAttribute('aria-label', 'Départ et arrivée : 1. Jérusalem, 4. Jérusalem (retour)');
    await expect(page.locator('[data-trajets]')).toHaveAttribute('data-trajets', '3', { timeout: 15_000 });
  });

  test('vue étape : journées en couleur, sous-étapes non placées signalées ; modifier une sous-étape', async ({ page }, info) => {
    await example(page);
    if (info.project.name === 'android') await page.getByRole('button', { name: 'Afficher la carte' }).click();
    await page.getByLabel('Vue').selectOption({ label: 'Étape 1 : Jérusalem' });
    await expect(page.getByText('Jour 2 (11/08)')).toBeVisible();
    await expect(page.getByText(/Sous-étapes non placées : Mur occidental, Yad Vashem/)).toBeVisible();
    await expect(page.locator('.pt-marker')).toHaveCount(1, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Modifier Mur occidental' }).click();
    const jer = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Jérusalem/ }) }).first();
    await jer.getByLabel('Titre').fill('Kotel');
    await jer.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText(/Sous-étapes non placées : Kotel, Yad Vashem/)).toBeVisible();
  });

  test('carte : épingles numérotées des étapes, alternative textuelle', async ({ page }, info) => {
    await example(page);
    if (info.project.name === 'android') await page.getByRole('button', { name: 'Afficher la carte' }).click();
    const markers = page.locator('.pt-marker');
    await expect(markers).toHaveCount(3, { timeout: 15_000 });
    await expect(markers.first()).toHaveText('1');
    await expect(markers.first()).toHaveClass(/pt-depart/);
    await expect(page.locator('[data-trajets]')).toHaveAttribute('data-trajets', '2', { timeout: 15_000 });
    // Les traits sont réellement dessinés (le calcul passe par le « worker » de MapLibre).
    await expect(page.locator('[data-traces]')).not.toHaveAttribute('data-traces', '0', { timeout: 15_000 });
    // Toutes les épingles tiennent dans le cadre de la carte (cadrage automatique).
    await page.locator('[data-trajets]').scrollIntoViewIfNeeded();
    const frame = await page.locator('[data-trajets]').boundingBox();
    for (const m of await markers.all()) {
      const b = await m.boundingBox();
      expect(frame && b && b.x >= frame.x && b.y >= frame.y && b.x + b.width <= frame.x + frame.width && b.y + b.height <= frame.y + frame.height).toBe(true);
    }
    await expect(page.getByText(/Même parcours que la liste des étapes/)).toBeVisible();
    await expect(markers.first()).toHaveAttribute('aria-label', 'Départ : 1. Jérusalem');
    await expect(markers.last()).toHaveAttribute('aria-label', 'Arrivée : 3. Eilat');
    await expect(page.getByLabel('Noms')).toHaveValue('fr');
    await page.getByLabel('Noms').selectOption('local');
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});
