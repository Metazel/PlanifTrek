import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

async function noBlockingA11y(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const blocking = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, JSON.stringify(blocking.map((v) => [v.id, v.nodes.map((n) => n.target)]), null, 2)).toEqual([]);
}

test.describe('Consentement et données', () => {
  test('premier lancement : rien n’est stocké avant le choix', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Où garder vos voyages ?' })).toBeVisible();
    const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
    expect(dbs).not.toContain('planiftrek');
    await noBlockingA11y(page);
    expect(errors).toEqual([]);
  });

  test('mode essai : rien n’est écrit, le choix est redemandé au rechargement', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Essayer sans enregistrer' }).click();
    await expect(page.getByText('Essai : rien n’est enregistré')).toBeVisible();
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    await expect(page.getByRole('heading', { name: 'Étapes' })).toBeVisible();
    const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
    expect(dbs).not.toContain('planiftrek');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Où garder vos voyages ?' })).toBeVisible();
  });

  test('accord puis effacement total', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Enregistrer mes voyages sur cet appareil' }).click();
    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    await page.getByRole('button', { name: '← Mes voyages' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: /Israël — août \(exemple\)/ })).toBeVisible();

    await page.getByRole('button', { name: 'Mes données' }).click();
    await page.getByRole('button', { name: 'Effacer toutes mes données' }).click();
    await expect(page.getByRole('heading', { name: 'Où garder vos voyages ?' })).toBeVisible();
    await expect(page.getByText('Toutes vos données ont été effacées')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Où garder vos voyages ?' })).toBeVisible();
    const consent = await page.evaluate(() => localStorage.getItem('planiftrek.consentement'));
    expect(consent).toBeNull();
  });

  test('applique la politique de sécurité du contenu', async ({ page }) => {
    await page.goto('./');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
  });
});
