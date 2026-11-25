# PlanifTrek — consignes pour Claude

Planificateur de voyage **local-first** : application statique sur GitHub Pages, données uniquement
sur l'appareil, aucun serveur. Un seul utilisateur prépare et pilote le voyage (PC + Android).

## Règles de travail (non négociables)
- Réponses en français, synthétiques, orientées action.
- Jamais de push sur `main` : branche → pull request → contrôles verts « Vérifier », « Construire »,
  « Recette navigateur ».
- Fusion « option A » : Claude fusionne seul les mises à jour Dependabot mineures/correctives,
  les correctifs de sécurité et les évolutions explicitement demandées, après CI verte.
  Tout le reste attend l'accord de David : version majeure, réglages du dépôt, nouvelle dépendance,
  nouveau serveur ou service tiers.
- Aucun secret dans le code, les workflows ou les tâches planifiées. Ne jamais réutiliser un jeton
  collé par erreur.
- Chaque évolution : partir des cas d'usage, challenger l'idée, regarder l'existant, MVP testé aux
  limites (métier, sécurité, frugalité, fiabilité des tiers, juridique), conformité loi / CNIL / RGAA,
  tests fonctionnels obligatoires avant mise en ligne.

## Architecture
- `src/domain/` : règles métier pures, sans dépendance UI, couvertes par Vitest. Toute règle nouvelle
  commence ici, avec ses tests.
- `src/ui/` : React. Aucun `dangerouslySetInnerHTML` ni `innerHTML` (règle ESLint).
- Activités rattachées à une étape (`stopId`), jamais à une position. Trajets identifiés par
  (départ, arrivée). Un trajet réservé n'est jamais supprimé automatiquement.
- Montants en unités mineures entières. Horaires en heure locale + fuseau IANA.
- Toute réorganisation passe par `previewReorder` (aperçu) puis `applyReorder` (après validation).

## Conformité intégrée
- Stockage local seulement après consentement explicite ; bouton « Effacer toutes mes données ».
- Pas de pièces d'identité. Adresses privées (étapes famille) jamais envoyées à un tiers.
- Aucun traceur, aucune mesure d'audience.
- Services tiers autorisés (CSP dans `vite.config.ts`) : fond de carte OpenFreeMap (vectoriel, sans clé ;
  repli tuiles OSM en consultation interactive),
  Nominatim (recherche sur clic, ≤ 1 req/s, cache, attribution), Protomaps (bouton « Créer le pack »),
  liens Google Maps. Tout ajout = accord de David.
- RGAA AA : alternative clavier à tout glisser-déposer, couleur jamais seule, liste texte doublant la carte.

## Commandes
- `npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run build`
- `npm run e2e` (local sans téléchargement de navigateur : `PW_CHROME=/usr/bin/google-chrome npm run e2e`)

## Incréments
1. Noyau : itinéraire, réorganisation, cohérence, carte en ligne ✓
2. Hors ligne ← suivant :, vue Aujourd'hui, relais PC → téléphone, exports
3. Budget et documents
4. Import e-mail / PDF
