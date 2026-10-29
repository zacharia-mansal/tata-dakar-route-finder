# Dakar Tata Route Finder — passation et audit du projet

> **Document vivant.** Dernier audit : 29 octobre 2026. Mettre à jour cette page à chaque jalon, avec la date, la branche et le commit contrôlés, les changements réellement terminés, les validations exécutées et les décisions encore ouvertes. Ne jamais y inscrire de secret ou de valeur de connexion.

## 1. Résumé rapide

Dakar Tata Route Finder vise à aider une personne à trouver un itinéraire en bus Tata entre deux lieux de Dakar, même si elle ne connaît ni les arrêts ni les noms affichés sur les bus. La V1 commence dans le secteur Sicap autour de Castor et Liberté ; l’extension de la couverture dépendra de la qualité des données et des retours terrain.

Le dépôt contient le socle Expo, le modèle métier de transport, le schéma Neon/PostGIS et une API TypeScript de recherche et de résolution de lieux testée. **Ce n’est pas encore une application de trajet utilisable de bout en bout** : le catalogue réel est vide, l’écran de recherche n’est pas relié à l’API, l’interface cartographique n’est pas construite et les services ne sont pas déployés.

État global : **développement local, branche Task 3, pas prêt pour la production**. Le code de la Task 2 est présent dans l’historique et son commit de schéma fait partie de la branche courante. Le product owner a indiqué que la PR #1 et la Task 2 étaient closes ; la réussite d’une validation Neon complète doit toutefois être confirmée dans GitHub Actions avant de la présenter comme vérifiée.

## 2. Origine du besoin et expérience voulue

Le produit s’adresse aux visiteurs de passage, aux personnes récemment installées à Dakar et aux Sénégalais qui ne connaissent pas forcément les itinéraires Tata. La première version se limite aux bus Tata et à une zone réduite, sans chercher à couvrir toute la ville dès le départ.

Le parcours prévu :

1. La personne saisit un départ et une destination, ou utilise le GPS pour son départ. Une nouvelle recherche d’itinéraire exige Internet.
2. L’application propose des lieux pertinents et demande de choisir en cas d’ambiguïté. Une sélection confirmée ne doit pas redevenir ambiguë côté serveur.
3. Elle trouve les arrêts adaptés les plus proches et montre les itinéraires vérifiés, les correspondances et les marches.
4. Elle montre le trajet sur une carte et distingue le lieu recherché, son alias éventuel, la zone desservie et la destination annoncée sur le bus.
5. Elle donne une formulation à demander au receveur. Exemple métier : une personne cherche l’ISM alors que le Tata 24 peut annoncer « Université ». L’app doit expliquer la relation sans laisser croire que le bus affiche « ISM ».

Le français est la langue principale ; l’anglais est une option dans les paramètres. Le wolof n’est pas prévu pour la V1.

## 3. Règles produit et données décidées

- Seuls les itinéraires **vérifiés et publiés** sont visibles. Les brouillons, candidats et rejets ne sont jamais publics.
- Chaque sens d’une ligne a son propre ordre d’arrêts, son libellé destination affiché et sa formulation à demander au receveur.
- Les propositions d’utilisateurs ne sont jamais publiées automatiquement : elles doivent être vérifiées.
- Les contributions donnent des points, pas d’argent. Le parcours envisagé permet d’indiquer les arrêts dans l’ordre et d’ajouter éventuellement une photo.
- Les photos doivent être privées, débarrassées des métadonnées EXIF et conservées pendant une durée définie. Le fournisseur et la durée restent à choisir.
- Une limite quotidienne de propositions par compte est prévue ; le seuil reste à décider.
- La recherche nécessite Internet. Le GPS peut fournir une position hors connexion si le système le permet ; l’expérience hors ligne de la carte et des résultats reste à définir.

### Décisions structurantes prises au fil du projet

- La première conception envisageait Supabase. Le choix a ensuite été remplacé par **Neon PostgreSQL + PostGIS**, en conservant les migrations SQL, dbmate et pgTAP, mais sans dépendance à Supabase CLI.
- La base n’est jamais interrogée directement depuis Expo : l’API Vercel lit uniquement la vue publiée avec un rôle lecture dédié.
- Le spike Neon Auth a montré une méthode Web côté serveur pour l’administration (`auth.getSession()` puis allowlist serveur par ID utilisateur Neon). L’obtention d’un jeton client Expo n’a pas été démontrée, Android n’a pas été testé et Neon Auth n’est donc pas retenu pour l’authentification des contributeurs.
- La validation de base prévue en CI utilise une branche Neon temporaire. Les PR de forks ne reçoivent aucun secret et doivent indiquer que la validation Neon est non exécutée. La validation complète distante reste à constater réellement.
- Les plans détaillés doivent être déplacés/versionnés sous `docs/plans/` après la Task 3 ; ce document est la passation de l’état courant, pas le remplacement de ces plans.

## 4. Architecture et stack

| Partie | Choix | État constaté |
|---|---|---|
| Client mobile/web | Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router ; Android, iPhone et web visés | Squelette, accueil, paramètres et langues présents. Le formulaire de recherche n’est pas encore fonctionnel. |
| Cartographie | MapLibre | Dépendances et plugin présents ; pas encore d’écran de carte ni de parcours complet. Fournisseur et clé publique à revoir dans la PR Cartes. |
| Domaine partagé | TypeScript dans `packages/domain` | Modèles de lieux, arrêts, directions, trajets et recherche d’itinéraires avec tests. |
| API | Fonctions TypeScript destinées à Vercel, dans `apps/api/api/` | Handlers `/api/resolve-places` et `/api/search-routes` et logique serveur présents. Déploiement Vercel non vérifié. |
| Base | Neon PostgreSQL + PostGIS ; dbmate dans `db/migrations/` | Deux migrations, seed vide et tests pgTAP présents. dbmate doit utiliser une connexion directe ; les lectures API passent par Neon HTTP et la variable serveur `DATABASE_URL_PUBLIC_API`, prévue pour l’accès de lecture poolé. |
| Rôles SQL | `tata_catalog_reader` pour la vue publiée ; connexion serveur dédiée `tata_public_api` | Le rôle de connexion doit être créé manuellement au déploiement, membre de `tata_catalog_reader`. Aucune migration ne crée de rôle de connexion ni de secret. |
| Dépendances/tests | pnpm workspace, TypeScript, Vitest | Configurations de typecheck présentes pour racine, client, domaine et API. |

Expo ne reçoit jamais `DATABASE_URL`, une chaîne PostgreSQL ou un secret d’administration. Le client appelle l’API HTTPS ; les secrets restent côté serveur.

### Rôles et connexions de base

- **Migration/propriétaire** : connexion directe Neon pour dbmate et les opérations contrôlées de schéma.
- **Lecteur catalogue** : rôle sans connexion `tata_catalog_reader`, limité à la vue publiée.
- **API publique** : rôle de connexion `tata_public_api`, créé manuellement, membre du rôle lecteur. Il doit avoir une limite de connexions et des délais SQL adaptés.
- **Contributions et administration** : rôles futurs à concevoir avec des privilèges séparés avant d’ajouter l’écriture.

Le README documente maintenant la création manuelle de `tata_public_api`, les délais `statement_timeout` / `lock_timeout` et une requête de contrôle des réglages effectifs via le rôle poolé. Un signal d’annulation dans l’application ne garantit pas l’arrêt immédiat d’une requête dans PostgreSQL.

## 5. Ce qui a été construit

### Task 1 — socle client

- Workspace pnpm et application Expo universelle configurés.
- Français et anglais disponibles dans les ressources du client.
- Validation des variables publiques et scan empêchant l’exposition de secrets serveur côté client.
- Accueil et écran de paramètres de langue présents.

### Task 2 — catalogue Tata vérifié

- Schéma PostgreSQL/PostGIS et migrations dbmate créés.
- Vue `public.published_transit_network` filtrée sur les lignes, directions, arrêts et lieux vérifiés et publiés.
- Formulation du receveur, alias, lieu desservi, destination affichée et sens de ligne sont représentés séparément.
- RLS et privilèges empêchent la lecture publique des tables sources ; le rôle lecteur accède à la vue publiée.
- Le test `db/tests/transit_catalog_rls.test.sql` vérifie les droits, les données non publiées, les deux sens et PostGIS qualifié dans `extensions`.
- `db/seeds/catalog.sql` est volontairement vide : aucun itinéraire Tata réel n’est inventé.
- Le commit `43d8c31` (« feat: add verified tata catalogue schema ») est un ancêtre de la branche actuelle. Le product owner a confirmé la fusion de la PR #1 et la clôture de la Task 2. La validation réelle migrations + seed + pgTAP + rollback + réapplication doit néanmoins être confirmée dans GitHub Actions ; aucun accès distant n’a été fait pendant cet audit.

### Task 3 — domaine de recherche et API

La branche actuelle contient notamment :

- Recherche de trajets dans le domaine, avec correspondances, ordre des arrêts et prise en charge distincte des deux directions.
- Résolution des lieux catalogue par identifiant depuis le réseau publié. Les lieux géocodés utilisent leurs coordonnées ; leur texte est un libellé d’affichage seulement.
- Garde approximative pour le géocodeur : latitude 14,55–14,90, longitude −17,60 à −17,05 ; rattachement à un lieu desservi à 1 200 m maximum. Ces limites sont une protection grossière contre l’abus, pas une frontière géographique ou de sécurité. À revalider sur carte et sur le terrain ; elles ne rejettent jamais un lieu du catalogue.
- Lecture de la vue publiée via Neon HTTP, validation des lignes à l’exécution et conversion des noms SQL en camelCase.
- Cache serveur du réseau limité à 30 secondes et 5 Mio.
- Adaptateur de marche Stadia injectable : segments identiques dédoublonnés, concurrence de 3, plafond de 12 appels par recherche. Les marches manquantes n’apparaissent pas comme validées ; la réponse peut signaler une recherche partielle.
- Délais applicatifs : 4 s pour une lecture Neon, 4 s par appel de marche et 10 s maximum pour l’ensemble de la requête. Les signaux d’annulation sont transmis. Le verrou SQL d’une seconde ne peut pas être garanti par un signal applicatif seul.
- Rate limit avec interface de magasin partagé et faux magasins en tests. En preview/production, l’absence de magasin partagé provoque un échec fermé ; le repli mémoire n’est autorisé qu’en développement local explicite.
- Limites de code provisoires : 60 requêtes/minute pour `resolve-places`, 20/minute pour `search-routes`. Ce ne sont pas une protection production. Le magasin Vercel partagé et un plafond global pour les appels externes payants restent à configurer.
- Les deux endpoints identifient maintenant le client avec `x-vercel-forwarded-for`, sans lire ni découper `x-forwarded-for`. Tests de régression pour les deux endpoints et pour le handler de recherche : une valeur falsifiée côté client ne remplace pas l’en-tête Vercel simulé. La documentation officielle Vercel décrit `x-forwarded-for` comme réécrit par Vercel et `x-vercel-forwarded-for` comme l’en-tête client correspondant : [Vercel — Request Headers](https://vercel.com/docs/headers/request-headers). Le comportement en production n’est pas encore observé.

Les handlers et la logique serveur sont testés, mais aucun écran client ne consomme encore ces endpoints.

### CI du workspace

Le workflow `.github/workflows/neon-db.yml` contient maintenant un job indépendant `workspace-validation` : installation verrouillée, typechecks, Vitest complet et scan client. Il n’utilise aucun secret Neon, possède uniquement `contents: read` et n’est pas filtré par origine de PR ; il est prévu pour tourner aussi sur les PR de forks. Le contrat du workflow est testé localement.

Le job est présent dans la branche locale. Le commit `1fbe022` ajoute aussi l’identité rate limit fondée sur `x-vercel-forwarded-for`, ses tests contre un `x-forwarded-for` falsifié et la procédure du rôle API dans le README. Le présent document est mis à jour séparément avec les résultats de ce jalon. Le push de la branche a échoué avant la création d’une PR ; aucun run GitHub de `workspace-validation` ni des jobs Neon n’a donc été observé. Les jobs Neon n’ont pas été modifiés pour le job workspace.

## 6. État produit réel

| Domaine | État au 29 octobre 2026 |
|---|---|
| Modèle métier de recherche | Implémenté et testé dans le domaine et l’API. |
| Catalogue réel Sicap/Castor/Liberté | **Absent** ; le seed est vide. Relevé et validation terrain nécessaires. |
| Écran de recherche utilisable | **Absent** ; l’accueil est encore un squelette et n’appelle pas l’API. |
| Résultats et instructions de trajet dans le client | **Absents**. |
| Carte, géolocalisation et guidage visuel | **Absents** dans l’app ; dépendances de carte seulement. |
| Recherche hors ligne | **Non implémentée** ; chaque nouvelle recherche nécessite Internet. |
| API déployée sur Vercel | **Non vérifiée / non déployée**. |
| Builds Android/iPhone | **Non vérifiés dans cet audit**. |
| Administration Next.js | **Non présente** dans ce dépôt. Le spike Neon Auth a validé un parcours Web côté serveur avec `auth.getSession()` et une allowlist par ID utilisateur Neon. |
| Authentification contributeurs | **À décider** parmi Clerk, Auth0 et Firebase ; Neon Auth n’est pas retenu pour Expo. |
| Contributions, points et photos privées | **Non implémentés**. |
| Itinéraires terrain publiés | **Aucun** dans les seeds. |

Voir [docs/neon-auth-spike.md](neon-auth-spike.md) pour les résultats et limites du spike d’authentification. Voir [docs/ci-first-run-checklist.md](ci-first-run-checklist.md) pour la checklist historique de validation Neon.

## 7. Git et validations exécutées

### État Git contrôlé le 29 octobre 2026

- Branche : `task-3-search-journeys`.
- Dernier commit local de code testé : `1fbe022` — `fix: trust Vercel client IP for rate limits`.
- `main` local : `bc2d5c1` ; le commit Task 2 `43d8c31` est un ancêtre de la branche courante.
- Le push autorisé de `task-3-search-journeys` a été tenté mais a échoué : le lancement du Git Credential Manager/Git Bash a retourné `NtCreateDirectoryObject ... 0xC0000022`, puis Git n’a pas pu lire le nom d’utilisateur HTTPS (`fatal: could not read Username for 'https://github.com': No such file or directory`). Aucune PR n’a été ouverte. La page GitHub de la branche indiquait `Ref is invalid` au contrôle ; les résultats Actions ne sont donc pas vérifiables pour cette branche.
- Les vérifications locales décrites ci-dessous ont été exécutées après le correctif rate limit. Le document est mis à jour avec ce résultat ; il reste à pousser avec la branche.

### Résultats locaux du 29 octobre 2026

| Vérification | Résultat réel |
|---|---|
| Vitest complet avec `node node_modules/vitest/vitest.mjs run` | **PASS** — 41 fichiers, 272 tests, après le correctif d’identité rate limit. |
| TypeScript racine, `tsconfig.json` | **PASS** — `tsc --noEmit`. |
| TypeScript client, `apps/client/tsconfig.json` | **PASS** — `tsc --noEmit`. |
| TypeScript domaine, `packages/domain/tsconfig.json` | **PASS** — `tsc --noEmit`. |
| TypeScript API, `apps/api/tsconfig.json` | **PASS** — `tsc --noEmit`. |
| Scan avec `node scripts/check-client-secrets.mjs` | **PASS** — 13 fichiers client et 1 fichier d’environnement racine scannés. |
| Commandes pnpm récursives / `pnpm typecheck` | **NON TERMINÉES** — les commandes lancées en parallèle sont restées silencieuses et ont été interrompues. Les quatre configurations ont été vérifiées directement avec le TypeScript local. |
| Validation Neon réelle : migrations, seed, pgTAP, rollback, réapplication | **NON EXÉCUTÉE pendant cet audit** — aucun accès à Neon. |
| Job `workspace-validation` sur GitHub Actions | **NON EXÉCUTÉ** — le push a échoué et aucune PR n’a été créée. |
| Jobs Neon sur GitHub Actions (migrations, seed, pgTAP, rollback, réapplication) | **NON EXÉCUTÉS / non observés** — aucun run associé à cette branche. |
| Tentative de push de `task-3-search-journeys` | **FAIL** — lancement de Git Credential Manager/Git Bash bloqué ; Git ne pouvait pas lire le nom d’utilisateur HTTPS. |
| PR `task-3-search-journeys` vers `main` | **NON CRÉÉE** — la branche n’a pas été publiée. |
| Appels réels Stadia/géocodeur | **NON EXÉCUTÉS** — les tests utilisent des mocks et dépendances injectées. |
| Espaces finaux du nouveau document Markdown | **PASS** — contrôle fichier direct, aucun espace final. `git diff --check` a aussi quitté avec code 0 pour les changements suivis. |

Les tests avec fixtures ne démontrent pas la justesse des vrais itinéraires, ni le fonctionnement en production de Neon, Vercel, Android, iPhone ou des services cartographiques.

## 8. Risques et écarts avant production

1. **Données :** sans itinéraires vérifiés, l’app ne peut pas rendre de résultat fiable. La collecte Sicap et la validation terrain sont prioritaires.
2. **Rate limit :** aucun magasin partagé de production n’est choisi ou configuré. L’API renvoie volontairement 503 en preview/production sans magasin. Le plafond global des appels payants reste à définir.
3. **Identité client de rate limit :** le code utilise `x-vercel-forwarded-for` et ignore les valeurs client `x-forwarded-for` / `x-real-ip`. Le test local couvre un XFF falsifié ; l’entrée Vercel réelle, et tout proxy placé devant Vercel, restent à confirmer sur le déploiement.
4. **Clé publique de carte :** `apps/client/src/config/env.ts` exige actuellement `EXPO_PUBLIC_STADIA_API_KEY` et ce nom figure dans `.env.example`. Le product owner avait reporté le choix du fournisseur/nom à la PR Cartes ; revoir ce décalage dans cette PR. La clé serveur `STADIA_ROUTING_API_KEY` doit rester privée.
5. **Neon production :** créer manuellement `tata_public_api`, limiter les connexions, configurer `statement_timeout` et `lock_timeout`, puis contrôler les valeurs effectives avec la connexion poolée retenue.
6. **Admin :** activer la vérification de l’e-mail et désactiver Allow Localhost en production. La liste d’administrateurs est côté serveur par ID Neon, jamais par e-mail. Les cookies entre domaines distincts ne sont pas testés.
7. **Contributions :** choisir l’auth mobile, le stockage privé, le quota journalier et la conservation des photos/propositions avant l’implémentation.
8. **Cartes et mode hors ligne :** décider du fournisseur cartographique, de la clé publique et de la politique de cache hors ligne. Aucun composant `RouteMap` n’est présent actuellement.
9. **Confidentialité/stores :** préparer la politique de confidentialité et les formulaires Google Play/App Store. La correction iPhone et le déplacement des plans sous `docs/plans/` ont été reportés après la Task 3.

## 9. Décisions encore ouvertes

- Quelles lignes et quels arrêts Tata vérifiés lancer en premier dans Sicap, et qui validera les relevés ?
- Quel fournisseur cartographique et quelle clé publique retenir ? Faut-il conserver ou remplacer l’actuelle variable client Stadia ?
- Quel magasin partagé configurer pour le rate limit Vercel, quelles limites recalibrer sur le terrain, et quel plafond global imposer aux appels externes payants ?
- Quel fournisseur d’authentification choisir pour les contributeurs parmi Clerk, Auth0 et Firebase ? L’admin peut conserver Neon Auth côté serveur ; les fournisseurs peuvent être différents.
- Quel stockage objet privé, quota quotidien et durée de conservation choisir pour les contributions et les photos ?
- Quels domaines utiliser pour app/API/admin, et le cookie admin fonctionne-t-il entre ces domaines ?
- Quelle stratégie hors ligne adopter pour carte et résultats ?
- Quels réglages SQL et limites de connexion appliquer en production au rôle `tata_public_api` ?

Ces décisions restent au product owner ; ce document ne les tranche pas.

## 10. Routine de mise à jour

À chaque jalon :

1. Actualiser date, branche, commit et état de l’arbre.
2. Déplacer les éléments entre réalisés, en cours et absents selon le code réellement livré.
3. Consigner les résultats des vérifications réellement exécutées ; distinguer tests locaux, CI et validation sur services distants.
4. Ajouter les nouveaux risques et décisions ouvertes sans décider à la place du product owner.
5. Ne jamais copier de valeur de `.env`, jeton, mot de passe ou chaîne de connexion dans ce document.
