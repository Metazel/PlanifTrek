import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accueil', () => {
  test('affiche l’état vide puis le circuit d’exemple sans incohérence', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'PlanifTrek' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Aucun voyage' })).toBeVisible();

    await page.getByRole('button', { name: "Charger l'exemple" }).click();
    await expect(page.getByRole('heading', { name: 'Israël — août' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Jérusalem' }).first()).toContainText('4 jour(s)');
    await expect(page.getByText('Aucune incohérence détectée.')).toBeVisible();

    // Aucune violation de la CSP ni erreur JavaScript.
    expect(errors).toEqual([]);
  });

  test('ne présente aucune anomalie d’accessibilité critique ou sérieuse', async ({ page }) => {
    await page.goto('./');
    for (const state of ['vide', 'exemple']) {
      if (state === 'exemple') await page.getByRole('button', { name: "Charger l'exemple" }).click();
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const blocking = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    }
  });

  test('applique la politique de sécurité du contenu', async ({ page }) => {
    await page.goto('./');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});
