/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://tiles.openfreemap.org",
  "connect-src 'self' https://nominatim.openstreetmap.org https://tile.openstreetmap.org https://tiles.openfreemap.org",
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

/**
 * Service worker sans dépendance : au build, injecte la liste des fichiers à précharger et une
 * version (empreinte du contenu) dans src/sw/sw.js, écrit dans dist/sw.js.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'planiftrek-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    writeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js').sort();
      const hash = createHash('sha256');
      for (const f of list) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const sw = readFileSync('src/sw/sw.js', 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(['./', ...list.map((f) => `./${f}`)]));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  // Le site est publié sur https://metazel.github.io/PlanifTrek/
  base: '/PlanifTrek/',
  plugins: [react(), tailwindcss(), cspMeta(), serviceWorker()],
  worker: { format: 'es' },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
