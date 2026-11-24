/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Politique de sécurité du contenu (CSP).
 * GitHub Pages ne permet pas de définir des en-têtes HTTP : la CSP est injectée
 * dans une balise <meta>, uniquement au build (le serveur de dev de Vite a besoin
 * de scripts inline pour le rechargement à chaud).
 * Chaque domaine externe autorisé correspond à un service tiers validé.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "connect-src 'self' https://nominatim.openstreetmap.org https://tile.openstreetmap.org",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'planiftrek-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  // Le site est publié sur https://metazel.github.io/PlanifTrek/
  base: '/PlanifTrek/',
  plugins: [react(), tailwindcss(), cspMeta()],
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
