# PlanifTrek

Planificateur de voyage sur mesure, utilisable hors ligne : les étapes datées, les trajets, les hébergements, le budget et les billets au même endroit, réorganisables à tout moment sans rien perdre. Un seul voyageur prépare et pilote le voyage, sur PC puis sur son téléphone Android. Version 0.1.0 (incrément 1 en cours).

| Incrément | Contenu | État |
| --- | --- | --- |
| 1. Noyau | Étapes et journées, réorganisation avec aperçu des impacts, boucle, contrôles de cohérence, carte en ligne | Règles métier faites et testées ; écrans en cours |
| 2. Hors ligne | Pack carte de la zone du voyage, vue « Aujourd'hui », passage PC → téléphone, exports Google Maps / KML / GeoJSON / CSV | À venir |
| 3. Budget et documents | Prévu, réel, reste à payer en plusieurs devises ; billets et réservations rattachés aux événements | À venir |
| 4. Import | E-mail de confirmation collé ou PDF déposé, lu sur l'appareil, file de validation | À venir |

## Ce que fait l'application

### Les moments du voyage

| Moment | Ce que fait l'application |
| --- | --- |
| Je construis mon itinéraire | Étapes (ville ou **visite famille**, sans coût, adresse privée) avec dates d'arrivée et de départ ; les journées sont générées automatiquement (Jérusalem 10 → 13 août : 4 journées, 3 nuits). |
| Je change le circuit | Insérer une étape (Mer Morte entre Netanya et Eilat), déplacer, **fermer la boucle** (Tel Aviv → … → Tel Aviv). Un **aperçu** montre les dates décalées et les trajets à créer ou à revoir avant d'appliquer ; deux choix : garder les dates de chaque étape ou les recalculer en cascade en gardant les durées. **Annuler** (Ctrl+Z) défait l'opération. |
| Mes réservations ne collent plus | Les activités restent toujours dans leur ville. Un trajet manquant est créé en brouillon ; un trajet réservé devenu inutile n'est jamais supprimé : il passe « à vérifier », et redevient « réservé » si l'étape revient à sa place. |
| Je saisis un vol ou un train | Durée calculée avec le fuseau de chaque lieu : Paris 10h → Tel Aviv 15h = 4 h, Tel Aviv 16h → Paris 18h30 = 3 h 30. Une arrivée avant le départ est refusée. |
| Suis-je prêt à partir ? | Alertes : nuit sans hébergement, deux hébergements la même nuit, hébergement ou activité hors des dates de son étape, jours non planifiés ou étapes qui se chevauchent. |

### Toutes les fonctions (règles métier en place)

- **Dates** : jours et nuits d'une étape, fins de mois et d'année, années bissextiles ; toute date impossible est refusée.
- **Fuseaux horaires** : heures saisies en heure locale du lieu (fuseau IANA), durées exactes, passage à l'heure d'été géré.
- **Montants** : saisie à la française (« 1 250,99 »), stockage en centimes entiers, conversion vers la devise du voyage au centime près ; un taux absent est signalé, jamais remplacé en silence.
- **Réorganisation** : aperçu sans effet, application après validation, fermeture de boucle, ordre invalide refusé (étape en double ou inconnue).
- **Cohérence** : contrôles relancés après chaque modification, messages lisibles et annoncés aux lecteurs d'écran.
- **Annulation** : 50 niveaux, rétablir.

## Habillage et accessibilité

- Interface sobre, cartes arrondies, mode clair (`#F8FAFC`) et sombre (`#0F172A`), chiffres tabulaires pour les horaires et les montants.
- Code couleur par catégorie (bleu transports, émeraude hébergements, ambre visites, violet budget), toujours doublé d'une icône et d'un libellé.
- **RGAA 4.1** visé niveau AA : alternative clavier à tout glisser-déposer, focus visible, liste des lieux en texte doublant la carte. Vérifié automatiquement à chaque version (axe-core WCAG 2.1 AA, sur PC et téléphone Android simulé) ; conformité non auditée par un tiers.

## Démarrer

```bash
npm ci
npm run dev        # développement
npm test           # règles métier (Vitest)
npm run lint       # lint
npm run typecheck  # types stricts
npm run build      # site statique dans dist/
npm run e2e        # recette navigateur (après le build) ; sans téléchargement de navigateur : PW_CHROME=/usr/bin/google-chrome npm run e2e
```

## Architecture

```
src/
  domain/   règles métier pures : dates, fuseaux et durées, montants, itinéraire (réorganisation, trajets, boucle), cohérence, historique
  ui/       écrans React
e2e/        recette navigateur (Playwright : parcours, accessibilité, CSP)
```

- **100 % client** : aucun serveur, aucun compte. Les données restent dans le navigateur de l'appareil, après accord ; les fichiers lourds (pack carte, billets) aussi, jamais dans le dépôt.
- **Modèle** : les activités sont rattachées à une étape, pas à une position, ce qui rend toute réorganisation sans perte. Un trajet est défini par son étape de départ et son étape d'arrivée.
- **Inspiration** : [TREK](https://github.com/mauriceboe/TREK) (AGPL-3.0) pour l'ergonomie ; aucun code repris. TREK demande un serveur, PlanifTrek non.

## Sécurité et vie privée

- Une dépendance d'exécution (React), versions figées. `npm audit` : 0 vulnérabilité.
- CSP stricte injectée au build (`script-src 'self'`, `object-src 'none'`, `connect-src` limité à `nominatim.openstreetmap.org` et `tile.openstreetmap.org`), pas de `unsafe-inline`.
- Aucun HTML injecté : `innerHTML` et `dangerouslySetInnerHTML` interdits par le lint.
- Stockage local seulement après consentement explicite, effacement total à tout instant. Pas de pièces d'identité. Les adresses privées des étapes famille ne sont jamais envoyées à un service tiers et sont exclues des exports Google Maps par défaut. Aucun traceur, aucune mesure d'audience.
- Services tiers : tuiles OpenStreetMap en consultation interactive (téléchargement pour le hors-ligne interdit par leur politique, d'où le pack carte Protomaps), Nominatim sur clic seulement (1 requête par seconde au plus, résultats gardés, attribution), liens Google Maps générés à la demande.

## Mise en ligne

Le workflow `.github/workflows/ci.yml` vérifie, construit et teste chaque pull request et chaque fusion sur `main` :

| Job | Contenu |
| --- | --- |
| Vérifier | `npm audit`, lint, types stricts, 25 tests unitaires |
| Construire | build de production, budget de poids (2 Mo au plus) |
| Recette navigateur | Playwright sur PC et Android simulé : parcours, accessibilité, CSP ; rapport en artefact en cas d'échec |

Le workflow `.github/workflows/pages.yml` publie le site à chaque fusion sur `main` : **https://metazel.github.io/PlanifTrek/** (Settings > Pages > Source : GitHub Actions). Actions épinglées par empreinte SHA, permissions limitées par job. Dependabot propose chaque semaine les mises à jour npm et GitHub Actions. Toute modification passe par une pull request.

## Limites connues

- Écrans de l'incrément 1 en cours : la version en ligne affiche le circuit d'exemple (Israël) et ses contrôles, sans saisie ni stockage.
- Fuseau horaire choisi par l'utilisateur pour chaque étape (pas de déduction automatique depuis la carte).
- Trajets estimés à vol d'oiseau : pas de calcul d'itinéraire routier.
- Taux de change saisis à la main.

Cartes © OpenStreetMap contributors. Application indépendante, non affiliée aux services cités. Licence MIT.
