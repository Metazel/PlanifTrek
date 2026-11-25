# PlanifTrek

Planificateur de voyage sur mesure, utilisable hors ligne : les étapes datées, les trajets, les hébergements, le budget et les billets au même endroit, réorganisables à tout moment sans rien perdre. Un seul voyageur prépare et pilote le voyage, sur PC puis sur son téléphone Android. Version 0.5.0 (incrément 1 terminé).

| Incrément | Contenu | État |
| --- | --- | --- |
| 1. Noyau | Étapes et journées, réorganisation avec aperçu des impacts, boucle, contrôles de cohérence, carte en ligne | Fait |
| 2. Hors ligne | Pack carte de la zone du voyage, vue « Aujourd'hui », passage PC → téléphone, exports Google Maps / KML / GeoJSON / CSV | À venir |
| 3. Budget et documents | Prévu, réel, reste à payer en plusieurs devises ; billets et réservations rattachés aux événements | À venir |
| 4. Import | E-mail de confirmation collé ou PDF déposé, lu sur l'appareil, file de validation | À venir |

## Ce que fait l'application

### Les moments du voyage

| Moment | Ce que fait l'application |
| --- | --- |
| Je construis mon itinéraire | Étapes (séjour, **passage** sans nuit comme un aéroport ou une prise de voiture, ou **visite famille** sans coût avec adresse privée), heures d'arrivée et de départ facultatives pour les demi-journées, **recherche du lieu** qui renseigne aussi le fuseau avec dates d'arrivée et de départ ; les journées sont générées automatiquement (Jérusalem 10 → 13 août : 4 journées, 3 nuits). |
| Je change le circuit | Insérer une étape (Mer Morte entre Netanya et Eilat), déplacer, **fermer la boucle** (Tel Aviv → … → Tel Aviv). Un **aperçu** montre les dates décalées et les trajets à créer ou à revoir avant d'appliquer ; deux choix : garder les dates de chaque étape ou les recalculer en cascade en gardant les durées. **Annuler** (Ctrl+Z) défait l'opération. |
| Mes réservations ne collent plus | Les activités restent toujours dans leur ville. Un trajet manquant est créé en brouillon ; un trajet réservé devenu inutile n'est jamais supprimé : il passe « à vérifier », et redevient « réservé » si l'étape revient à sa place. |
| Je saisis un vol ou un train | Durée calculée avec le fuseau de chaque lieu : Paris 10h → Tel Aviv 15h = 4 h, Tel Aviv 16h → Paris 18h30 = 3 h 30. Une arrivée avant le départ est refusée. |
| Suis-je prêt à partir ? | Alertes : nuit sans hébergement, deux hébergements la même nuit, hébergement ou activité hors des dates de son étape, jours non planifiés ou étapes qui se chevauchent. |

### Toutes les fonctions

- **Mes données** : au premier lancement, vous choisissez d'enregistrer vos voyages sur l'appareil ou d'essayer sans rien enregistrer. Rien n'est écrit avant ce choix. « Mes données » efface tout, choix compris.
- **Mes voyages** : liste avec dates, nombre d'étapes et points à vérifier ; création ; circuit d'exemple (Israël) ; suppression confirmée.
- **Étapes** : ajout et modification (nom, ville ou visite famille, dates, fuseau horaire, adresse privée pour la famille), dates et fuseau proposés à partir de l'étape précédente, suppression qui annonce ce qu'elle emporte (événements, trajets réservés).
- **Durée** : boutons − / + nuit sur chaque étape ; les étapes suivantes glissent d'autant, leurs sous-étapes non réservées suivent, les réservations restent et sont signalées.
- **Hébergement** : chaque étape indique ses nuits non couvertes et propose « Ajouter un hébergement » pré-rempli.
- **Sous-étapes** : repas, déplacement, visite, activité, famille, événement (soirée, mariage), temps libre, avec heure facultative ; classées par journée, réorganisables (glisser-déposer ou ↑ ↓) et transférables vers une autre étape.
- **Trajets** : entre deux étapes, « + Trajet » puis mode (avion, train, voiture, bus, bateau, taxi, marche), lieux et horaires de départ et d'arrivée en heure locale, durée calculée, n° de vol ou de réservation, prix et devise, statut de paiement, « à prévoir » ou « réservé ». Les trajets devenus hors circuit après une réorganisation sont listés pour être gardés ou retirés.
- **Carte** : fond OpenFreeMap avec les noms en français, en langue locale ou en anglais (repli automatique sur les tuiles OpenStreetMap) ; à droite sur grand écran, à afficher sur téléphone ; épingles numérotées dans l'ordre du circuit (▶ départ, ■ arrivée, ⟲ « 1 · 5 » quand le départ et l'arrivée sont au même endroit), traits du vert au rouge dans le sens du voyage (tirets pour l'avion, gris pointillé quand une étape n'est pas placée), cadrage automatique. Chargée à part, seulement quand elle s'affiche. Les étapes sans position sont listées sous la carte.
- **Vues de carte** : « Tout le voyage » (étapes, aéroports et gares de départ et d'arrivée, hébergements, chemin de l'un à l'autre) ou une étape (chaque journée en couleur : hébergement → sous-étapes dans l'ordre → hébergement), avec légende des journées et liste des sous-étapes non placées.
- **Positions** : « 📍 Chercher le lieu » sur les étapes, les hébergements, les sous-étapes et les lieux de départ et d'arrivée des trajets (jamais pour la famille). Sous-étapes et hébergements modifiables (✎).
- **Nuit en transit** : pas d'alerte « nuit sans hébergement » quand un trajet part entre 18 h et 8 h le lendemain ou roule de nuit (chambre libérée en journée, vol à 5 h).
- **Recherche de lieu** : bouton « Chercher » (Nominatim, sur clic, 1 requête/s, résultats gardés), jamais pour une visite famille ; en cas de panne, saisie libre.
- **Réorganiser** : glisser-déposer à la souris, au doigt ou au clavier (Espace, flèches, Espace), boutons monter et descendre ; aperçu avant d'appliquer ; « Fermer la boucle ».
- **Annuler / Rétablir** : boutons et Ctrl+Z, Ctrl+Maj+Z (50 niveaux).
- **Contrôles** : relancés à chaque modification et annoncés aux lecteurs d'écran.
- **Règles de calcul** : dates (fins de mois, années bissextiles), durées avec fuseaux et heure d'été, montants en centimes avec conversion au centime près.

## Habillage et accessibilité

- Interface sobre, cartes arrondies, mode clair (`#F8FAFC`) et sombre (`#0F172A`), chiffres tabulaires pour les horaires et les montants.
- Code couleur par catégorie (bleu transports, émeraude hébergements, ambre visites, violet budget), toujours doublé d'une icône et d'un libellé.
- **RGAA 4.1** visé niveau AA : glisser-déposer utilisable au clavier avec annonces vocales en français, boutons monter et descendre, boîtes de dialogue natives (focus piégé, Échap), erreurs de saisie liées au champ, lien d'évitement, cibles tactiles de 44 px. Vérifié automatiquement à chaque version (axe-core WCAG 2.1 AA, sur PC et téléphone Android simulé) ; conformité non auditée par un tiers.

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
  domain/   règles métier pures : dates, fuseaux et durées, montants, itinéraire (réorganisation, trajets, boucle), cohérence, historique, saisie, schéma de validation
  state/    stockage local IndexedDB (Dexie) après consentement, mode essai en mémoire, store (Zustand)
  ui/       écrans React (consentement, voyages, éditeur, aperçu de réorganisation)
e2e/        recette navigateur (Playwright : parcours, accessibilité, CSP)
```

- **100 % client** : aucun serveur, aucun compte. Les données restent dans le navigateur de l'appareil, après accord ; les fichiers lourds (pack carte, billets) aussi, jamais dans le dépôt.
- **Modèle** : les activités sont rattachées à une étape, pas à une position, ce qui rend toute réorganisation sans perte. Un trajet est défini par son étape de départ et son étape d'arrivée.
- **Inspiration** : [TREK](https://github.com/mauriceboe/TREK) (AGPL-3.0) pour l'ergonomie ; aucun code repris. TREK demande un serveur, PlanifTrek non.

## Sécurité et vie privée

- Dépendances d'exécution : React, Dexie, Zod, Zustand, dnd-kit, MapLibre GL, versions figées. `npm audit` : 0 vulnérabilité.
- Toute donnée relue (stockage, futur fichier importé) est revalidée par un schéma strict : identifiants restreints, tailles bornées, dates et fuseaux vérifiés ; une donnée altérée est écartée et signalée. Textes saisis nettoyés (caractères de contrôle et de direction retirés, longueur bornée).
- CSP stricte injectée au build (`script-src 'self'`, `object-src 'none'`, `connect-src` limité à `nominatim.openstreetmap.org`, `tiles.openfreemap.org` et `tile.openstreetmap.org` ; recette sans aucun appel réel à ces services (réponses simulées)), pas de `unsafe-inline`.
- Aucun HTML injecté : `innerHTML` et `dangerouslySetInnerHTML` interdits par le lint.
- Stockage local seulement après consentement explicite, effacement total à tout instant. Pas de pièces d'identité. Les adresses privées des étapes famille ne sont jamais envoyées à un service tiers et sont exclues des exports Google Maps par défaut. Aucun traceur, aucune mesure d'audience.
- Services tiers : fond de carte OpenFreeMap (gratuit, sans clé, sans cookie), tuiles OpenStreetMap en repli et en consultation interactive (téléchargement pour le hors-ligne interdit par leur politique, d'où le pack carte Protomaps), Nominatim sur clic seulement (1 requête par seconde au plus, résultats gardés, attribution), liens Google Maps générés à la demande.

## Mise en ligne

Le workflow `.github/workflows/ci.yml` vérifie, construit et teste chaque pull request et chaque fusion sur `main` :

| Job | Contenu |
| --- | --- |
| Vérifier | `npm audit`, lint, types stricts, 47 tests unitaires |
| Construire | build de production, chemin de publication conforme au nom du dépôt, budget de poids (chargement initial ≤ 700 ko, carte chargée à part, total ≤ 3 Mo) |
| Recette navigateur | 16 scénarios Playwright sur PC et Android simulé (consentement, effacement, saisie, passage, +/- nuits, sous-étapes, recherche de lieu simulée et en panne, trajets, carte, réorganisation au clavier, boucle, suppression, accessibilité, CSP) ; rapport en artefact en cas d'échec |

Le workflow `.github/workflows/pages.yml` publie le site à chaque fusion sur `main` : **https://metazel.github.io/PlanifTrek/** (Settings > Pages > Source : GitHub Actions). Actions épinglées par empreinte SHA, permissions limitées par job. Dependabot propose chaque semaine les mises à jour npm et GitHub Actions. Toute modification passe par une pull request.

## Limites connues

- Carte en ligne seulement : le hors-ligne (pack carte) arrive à l'incrément 2.
- Un décalage d'étapes ne déplace jamais une réservation (hébergement, sous-étape avec référence ou statut de paiement) : elle est signalée, à corriger à la main.
- Fuseau déduit du pays pour une quarantaine de pays ; sinon, à choisir.
- Fuseau horaire choisi par l'utilisateur pour chaque étape (pas de déduction automatique depuis la carte).
- Trajets estimés à vol d'oiseau : pas de calcul d'itinéraire routier.
- Taux de change saisis à la main.

Cartes © OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors. Application indépendante, non affiliée aux services cités. Licence MIT.
