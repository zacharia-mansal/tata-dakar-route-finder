# Essai technique jetable : Neon Auth avec Expo SDK 58

## Dernière tentative encadrée — résultats faisant foi (2026-10-24)

Cette section remplace les résultats antérieurs ci-dessous. Le client du parcours Expo Web était uniquement `@neondatabase/auth` (adaptateur exporté par ce paquet), sans appel à `better-auth` ni à `@better-auth/expo`. Le serveur était une app Next.js locale utilisant le SDK serveur officiel Neon. La branche enfant `spike-neon-auth-validation` est conservée comme demandé; le projet Tata et la branche parente n’ont pas été modifiés.

Les variables locales `NEON_AUTH_BASE_URL` et `NEON_AUTH_JWKS_URL` sont toutes deux **définies**. Aucune valeur d’environnement, URL de branche, adresse e-mail, identifiant d’utilisateur ou jeton n’est reproduit ici.

### Critères de cette dernière tentative

| # | Critère vérifié | Résultat | Observations sans données secrètes |
|---|---|---|---|
| 1 | Neon Auth et les endpoints de la branche d’essai sont configurés. | **PASS** | Les deux variables attendues sont définies. Le JWKS a répondu HTTP 200 et exposé une clé; sa valeur et son URL ne sont pas consignées. |
| 2 | Inscription et connexion sur un development build Android Expo SDK 58. | **NON EXÉCUTÉ** | Aucun test Android natif n’a été fait. `java` et `adb` sont absents; Expo Go ne satisfait pas ce critère. |
| 3 | Persistance après fermeture/réouverture de l’app Android. | **NON EXÉCUTÉ** | Android non exécuté. Sur Expo Web, la session est restée active après rechargement de la page. |
| 4 | Un serveur peut-il valider une vraie session Neon Web ? | **PASS** | `createNeonAuth(...).getSession()` dans une route API Next.js a reçu la session réelle via cookie et a renvoyé `sessionValidated: true`. La route a ensuite appliqué l’allowlist côté serveur. Cela valide la session sans Bearer JWT. |
| 5 | Vérification d’un JWT Neon réel avec `jose` et le JWKS de branche. | **NON EXÉCUTÉ** | Aucun JWT réel n’a été fourni par les méthodes du client; l’en-tête et les claims n’ont donc pas pu être inspectés, et `jwtVerify` n’a pas été appelé avec un jeton réel. La suite locale avec JWKS synthétique ne remplace pas cette validation. |
| 6 | Parcours Expo Web et contrôle d’accès admin. | **PASS** | Inscription, connexion et persistance Web fonctionnent. Le compte Neon réel créé pour cet essai, absent de l’allowlist, a reçu **403** (`admin_access_required`), puis le même compte a reçu **200** après ajout temporaire de son identifiant à la liste d’administration côté serveur. Le dispositif temporaire d’enrôlement a été retiré du code avant la revue. |

### Résultat de la récupération et du diagnostic de jeton

| Méthode documentée essayée avec le client Neon | Résultat |
|---|---|
| `authClient.token()` | Aucun jeton retourné; aucun objet d’erreur. |
| `authClient.getSession()` puis lecture du header `set-auth-jwt` | Aucun jeton retourné; aucun objet d’erreur. |
| `session.access_token` | Champ absent. |
| Ancienne méthode `getJWTToken()` d’un essai antérieur | Erreur exacte observée alors : `user_not_found: HTTP 404`. Elle ne s’est pas reproduite dans le parcours actuel avec `authClient.token()`; la cause de cette ancienne erreur n’est pas démontrée. |

Comme aucune chaîne de jeton n’a été retournée, les diagnostics suivants sont **NON EXÉCUTÉS / non applicables** : trois segments séparés par des points, `alg`, `typ`, noms de claims (`iss`, `aud`, `sub`, `exp`, etc.) et booléen de correspondance de l’issuer. Aucune valeur de jeton ou de claim n’a été journalisée.

### Méthode serveur validée et portée

La documentation Neon actuelle privilégie les cookies HTTP-only pour les sessions Web et indique que `auth.getSession()` lit la session courante dans les API Routes Next.js; `auth.handler()` fournit le proxy des requêtes d’authentification. Le test local a suivi ces APIs documentées. La route d’administration vérifie ensuite `session.user.id` contre une liste maintenue uniquement côté serveur. Un jeton ne suffit donc pas à donner le rôle admin. La configuration locale de cookie du serveur est requise; elle est ignorée par Git et n’est pas reproduite dans ce rapport. [Référence SDK serveur Next.js](https://neon.com/docs/auth/reference/nextjs-server), [flux d’authentification Neon](https://neon.com/docs/auth/authentication-flow).

La documentation JWT actuelle recommande `authClient.token()` ou le header `set-auth-jwt`, et demande `credentials: 'include'` pour les appels cross-origin. Son exemple de validation `jose` utilise le JWKS et l’issuer égal à l’origine Neon. L’exemple de payload montre aussi `aud` égal à cette origine; aucune audience alternative n’a été inventée. Puisqu’aucun jeton réel n’est sorti, ni ces claims ni la validation JWKS réelle n’ont pu être confirmées. [Guide Neon JWT](https://neon.com/docs/auth/guides/plugins/jwt).

### Erreurs exactes, causes démontrées et limites

- Premier essai du proxy Next local : le client affichait `Failed to fetch`; la sortie serveur indiquait exactement `TypeError: Cannot destructure property 'params' of 'undefined' as it is undefined.` La cause démontrée était le wrapper local qui ne transmettait pas le second argument/context à `auth.handler()`. Le wrapper a été corrigé pour transmettre `request` et `context`; ensuite l’endpoint d’auth a répondu HTTP 200 et la connexion a réussi. Ce défaut était dans le prototype local, pas dans Neon Auth.
- Sur les appels directs Neon du client, les trois méthodes de jeton ont rendu aucun jeton sans erreur. **Cause réelle non démontrée**. L’hypothèse de cookies tiers/cross-origin reste une hypothèse; le client avait été configuré avec `credentials: 'include'` conformément à la doc.
- Après rechargements à chaud, Metro a signalé exactement `Requiring unknown module "855". If you are sure the module exists, try restarting Metro.` Un redémarrage Expo avec cache vidé a rétabli le bundle. Ce n’était pas une erreur d’authentification.
- Le chemin `auth.getSession()` prouve la validation de session Web dans une route Next.js locale. Il ne prouve pas la validation de JWT par `jose`, ni le comportement Android natif, ni la compatibilité avec une fonction TypeScript générique hors Next.js.
- Neon Auth est en bêta; d’après la configuration fournie par l’utilisateur, MFA est absent et les inscriptions ne sont pas restreignables. Le serveur doit donc maintenir sa propre allowlist admin. Le SDK serveur documenté est spécifique à Next.js; une fonction serverless Vercel sous forme de route API Next est représentée par cet essai, mais pas un handler Vercel indépendant.

### Versions réellement testées dans ce parcours

| Outil / dépendance | Version | Résultat |
|---|---:|---|
| Expo | 58.0.19 | Expo Web exécuté; Android non exécuté |
| Expo runtime | 58.0.0 | Affiché dans l’app |
| React Native | 0.88.0 | Utilisé par Expo Web |
| `@neondatabase/auth` | 0.7.0-beta | Client Web, inscription, connexion, récupération de jeton; SDK serveur Next.js testé |
| Next.js | 16.3.8 | Route locale `auth.handler()` et route API `auth.getSession()` |
| `jose` | 6.2.13 | Tests locaux synthétiques uniquement; aucun JWT réel vérifié |
| Node.js | 24.18.0 | Utilisé |
| npm | 11.16.0 | Utilisé |

Les paquets Better Auth et Expo associés à un essai antérieur restent présents dans l’installation/lockfile, mais ne sont pas importés ni utilisés dans le parcours isolé ci-dessus.

### Validation locale et revue finale

| Vérification | Résultat |
|---|---|
| Inscription Neon depuis Expo Web | **PASS** |
| Connexion Neon depuis Expo Web | **PASS** |
| Session Web après rechargement | **PASS** |
| `authClient.token()` / header / `access_token` réels | **FAIL** — aucun jeton renvoyé, aucun objet d’erreur |
| `auth.getSession()` dans la route API Next | **PASS** — session valide reconnue |
| Compte réel absent de l’allowlist | **PASS** — HTTP 403 `admin_access_required` |
| Même compte après présence dans l’allowlist serveur | **PASS** — HTTP 200 |
| `jose` avec JWKS Neon et jeton réel | **NON EXÉCUTÉ** — aucun jeton à vérifier |
| Tests unitaires locaux `npm run test:server` | **PASS** — `valid=200 expired=401 forged=401 absent=401 non-admin=403 no-exp=401 wrong-aud=401` |
| Typecheck serveur | **PASS** — `npm run typecheck:server -- --pretty false` |
| Typecheck Expo | **PASS** — `npx tsc --noEmit --pretty false` après retrait du helper de test |
| Expo Doctor | **PASS historique** — 20/20 contrôles lors de l’essai précédent; non relancé pour cette tentative ciblée |
| Android natif | **NON EXÉCUTÉ** — `java` et `adb` absents |

Revue de code finale du spike : aucune URL/token/claim sensible n’est affiché par l’application ou la route; les erreurs d’auth UI sont assainies; l’API admin renvoie uniquement des statuts et codes génériques. La session est lue côté serveur avec le SDK Neon, puis l’identifiant utilisateur est comparé à `ADMIN_USER_IDS` fourni au processus serveur. Le helper temporaire utilisé pour prouver les deux côtés de l’allowlist a été retiré; le code final ne contient pas de mécanisme d’auto-promotion. L’endpoint local d’auth ne doit pas être déployé sans configurer une origine CORS et cookies adaptées au domaine de production. Le dossier reste hors du dépôt Tata et aucun commit n’a été créé.

### Conclusion du spike

**Conclusion : voici la méthode validée de vérification côté serveur et ses limites.** Dans ce prototype Web, la route Next.js appelle `auth.getSession()` depuis le SDK serveur Neon, puis contrôle l’identifiant dans une allowlist gérée côté serveur; le résultat observé est 403 sans inscription dans la liste et 200 avec. La vérification d’un JWT réel par JWKS, Android natif et les contributeurs restent non démontrées.

**Statut : dernière tentative terminée; branche enfant conservée conformément à la demande.** Ce dossier est un spike isolé, voisin de `outputs/tata-dakar-route-finder` et hors de son dépôt. Le projet Tata n’a pas été modifié. Les essais Neon ont utilisé la branche enfant `spike-neon-auth-validation`, jamais sa branche parente `production`.

Les variables locales `NEON_AUTH_BASE_URL` et `NEON_AUTH_JWKS_URL` sont définies dans le `.env` ignoré. Le JWKS a répondu sans que son URL soit affichée. Les adresses, mots de passe et jetons de deux comptes jetables n’ont pas été inscrits dans les fichiers ni imprimés. Le `.env` de l’application ne contient que `EXPO_PUBLIC_NEON_AUTH_BASE_URL`; le JWKS reste côté serveur.

## Historique des essais précédents — remplacé par les résultats ci-dessus

Les tableaux et notes qui suivent décrivent les essais antérieurs, avant la dernière tentative isolée. Ils sont conservés comme historique; la section « Dernière tentative encadrée » fait foi.

## Critères de réussite définis avant l’implémentation

| # | Critère | Statut | Résultat observé |
|---|---|---|---|
| 1 | Neon Auth est actif sur la branche enfant et les URL de base/JWKS de cette branche sont configurées sans les afficher. | **PASS** | Le fournisseur Neon Auth de la branche enfant est Better Auth; les deux variables sont définies; le JWKS répond HTTP 200 et contient une clé. L’inscription et la connexion web confirment que l’URL de base fonctionne. |
| 2 | Un development build Android Expo SDK 58 peut créer un compte et ouvrir une session par e-mail. | **NON EXÉCUTÉ** | `java` et `adb` sont absents; aucun émulateur ni appareil Android n’est disponible pour lancer le development build. |
| 3 | La session Android survit à la fermeture et à la réouverture de l’app. | **NON EXÉCUTÉ** | Aucun build ni redémarrage Android n’a pu être lancé. Sur Expo Web, Better Auth a conservé la session après rechargement de la page. |
| 4 | L’application obtient un jeton à envoyer à une API. | **PASS, limité** | Le client Better Auth Expo sur Web a fourni un jeton non vide et l’application l’a envoyé à la route locale. Le SDK Neon, lui, a échoué lors de la récupération du jeton : `user_not_found: HTTP 404`. Le jeton obtenu par Better Auth n’a pas été accepté par le vérificateur JWKS (voir critère 5). |
| 5 | La fonction TypeScript accepte un JWT valide et refuse un jeton expiré, falsifié ou absent, avec le JWKS Neon. | **FAIL** | Les scénarios locaux avec JWKS de test passent : valide autorisé HTTP 200, expiré/falsifié/absent HTTP 401. Le JWKS Neon répond, mais le jeton du client Better Auth est refusé par la route avec HTTP 401 `unauthorized`; le SDK Neon retourne l’erreur HTTP 404 ci-dessus avant de fournir un jeton. Aucun jeton Neon valide n’a donc été accepté par la route. La route masque volontairement le détail JOSE et ne journalise pas le jeton ou l’URL. |
| 6 | Le même parcours fonctionne sur Expo Web pour l’administration. | **FAIL** | Inscription, connexion et session conservée après rechargement réussissent sur Expo Web avec le plugin Better Auth. L’accès à la route d’administration échoue ensuite avec HTTP 401 `unauthorized`; l’intégration complète d’administration ne passe donc pas. |
| 7 | Un compte Neon fraîchement créé, valide mais absent de l’allowlist serveur est refusé par la route admin. | **NON EXÉCUTÉ** | Le test local avec un JWT synthétique valide d’un utilisateur absent de l’allowlist retourne HTTP 403. Le compte Neon fraîchement créé n’a pas produit de jeton accepté par JWKS; sa requête s’arrête en HTTP 401 avant l’évaluation de l’allowlist. |

### Résultats de validation locale

| Vérification | Résultat |
|---|---|
| Test serveur local `npm run test:server` | **PASS** — `valid=200 expired=401 forged=401 absent=401 non-admin=403` |
| Typecheck serveur | **PASS** — `npm run typecheck:server -- --pretty false` |
| Typecheck application | **PASS** — `npx tsc --noEmit --pretty false` |
| Expo Doctor | **PASS** — 20/20 contrôles, aucun problème signalé |
| JWKS de la branche enfant | **PASS** — HTTP 200, une clé |
| Expo Web | **PASS partiel** — l’application se charge; inscription, connexion et session après rechargement passent; vérification admin refusée HTTP 401 |
| Android | **NON EXÉCUTÉ** — Java et `adb` absents |

### Incidents d’environnement rencontrés

- `pnpm dlx` n’a pas pu écrire dans son store global (`Failed to write cafs ... Accès refusé (os error 5)`), puis a terminé sur `thread '<unknown>' has overflowed its stack` avec le store local. L’installation a été faite avec npm.
- Expo CLI ne pouvait pas créer `C:\Users\user\.expo` (`EPERM: operation not permitted, mkdir 'C:\Users\user\.expo'`). En utilisant le dossier ignoré `app\.local-profile` comme `USERPROFILE`, le serveur Expo Web a démarré.
- Les premiers bundles web ont échoué sur `Unable to resolve "fbjs/lib/invariant"` puis `Cannot find module '../lightningcss.win32-x64-msvc.node'`. Les fichiers de dépendance manquants ont été réinstallés localement; le bundle a ensuite réussi et Expo Doctor a passé ses 20 contrôles.

## Versions réellement installées et essayées

| Outil / dépendance | Version | Essai |
|---|---:|---|
| Node.js | 24.18.0 | Utilisé |
| npm | 11.16.0 | Utilisé |
| Expo | 58.0.19 | Expo Web exécuté; build Android non exécuté |
| Expo runtime affiché | 58.0.0 | Vérifié dans l’application |
| React Native | 0.88.0 | Utilisé par Expo Web |
| `@neondatabase/auth` | 0.7.0-beta | Inscription/connexion web essayées; récupération JWT échoue `user_not_found: HTTP 404` |
| `better-auth` | 1.7.12 | Inscription et connexion web essayées |
| `@better-auth/expo` | 1.7.12 | Plugin utilisé sur Expo Web; persistance web observée; jeton refusé par la route |
| `expo-secure-store` | 58.0.2 | Installé; intégration Android non exécutée |
| `jose` | 6.2.13 | Vérification serveur locale et JWKS Neon essayés |
| `@neondatabase/neon-js` | 0.9.0-beta | Version relevée, mais paquet non installé et non essayé |

Ces versions sont celles du `package-lock.json` du spike. La documentation Better Auth consultée décrit l’intégration Expo à partir d’Expo SDK 55; la compatibilité native avec SDK 58 n’a pas pu être démontrée faute de build Android.

## Documentation et limites connues

- Neon présente Neon Auth comme un service géré construit sur Better Auth, mais n’autorise pas les plugins serveur Better Auth personnalisés ni les handlers personnalisés. Son SDK est la voie recommandée. Chaque branche possède son propre endpoint Auth. Sources : [Neon Auth et ses branches](https://neon.com/blog/neon-auth-branchable-identity-in-your-database), [authentification en environnement de staging Neon](https://neon.com/blog/handling-auth-in-a-staging-environment).
- Better Auth documente l’intégration native Expo et Web avec `@better-auth/expo/client`, SecureStore et les liens de rappel mobiles. Cette intégration demande aussi le plugin Expo côté serveur; Neon Managed Auth ne permet pas de l’ajouter. Le test web montre que les appels d’inscription/connexion du client passent, mais ne démontre pas la compatibilité des jetons d’API. Source : [guide Better Auth Expo](https://better-auth.com/docs/integrations/expo).
- Les versions `better-auth` / `@better-auth/expo` 1.7.12 ont pu appeler les endpoints d’inscription et de connexion Neon sur Web avec `@neondatabase/auth` 0.7.0-beta en parallèle. La compatibilité complète requise n’est pas acquise : le jeton du plugin ne passe pas la vérification serveur et le SDK Neon ne fournit pas le JWT dans ce parcours (`user_not_found: HTTP 404`). Aucun parcours Android n’a été testé.
- Expo SDK 58 est bien celui installé pour le prototype; la documentation Expo recommande un development build pour tester les modules natifs. Aucun développement Android n’a été exécuté. Source : [notes Expo SDK 58](https://expo.dev/changelog/sdk-58).
- Les éléments de configuration suivants viennent de l’utilisateur et n’ont pas été vérifiés indépendamment : Neon Auth est en bêta; MFA absent; inscriptions non restreignables; inscription e-mail active; vérification e-mail désactivée; Allow Localhost actif; aucun domaine de confiance ajouté.
- La documentation Better Auth n’établit pas qu’un jeton renvoyé par le client Expo est un JWT signé compatible avec le JWKS Neon. Dans cet essai, l’API retourne HTTP 401; la cause détaillée est volontairement masquée. L’hypothèse d’une incompatibilité de format ou de claims reste une **inférence**, pas une cause confirmée.
- Expo Doctor a passé ses 20 contrôles. npm a néanmoins signalé 7 vulnérabilités de dépendances (niveau élevé); elles n’ont pas été auditées ni corrigées dans ce spike.

## Revue de code finale

Revue manuelle indépendante des tests d’intégration, sur les fichiers de l’application et du serveur :

- Le serveur exige un Bearer token, vérifie sa signature avec `jose` et le JWKS configuré, impose maintenant une valeur `issuer` obligatoire, vérifie `sub`, puis vérifie l’allowlist côté serveur. Un utilisateur signé mais absent de cette liste reçoit HTTP 403; les erreurs de vérification reçoivent HTTP 401.
- Le serveur local utilise l’URL de base Neon comme issuer attendu. Comme le JWT Neon n’a pas été accepté et que l’erreur de vérification reste masquée, la correspondance réelle de la claim `iss` n’a pas pu être confirmée.
- L’allowlist n’est jamais fournie par le client. Le serveur ne renvoie ni le JWT, ni les URL, ni les détails bruts de JOSE dans la réponse ou les logs.
- Le `.env` racine et celui de l’app sont ignorés par les règles locales; aucun `DATABASE_URL`, mot de passe ou URL de connexion PostgreSQL n’est nécessaire pour l’app Expo. Le JWKS n’est pas exposé via `EXPO_PUBLIC_`.
- Le serveur local écoute sur toutes les interfaces et autorise CORS `*` pour permettre un appareil de développement d’y accéder. Il s’agit uniquement d’un serveur de test local; il ne doit pas être déployé tel quel. Une route Vercel réelle doit conserver l’issuer obligatoire, une liste d’administrateurs côté serveur, et ajouter ses limites de débit et son origine CORS de production.
- Aucun changement au projet Tata ni aucun commit n’a été fait. Le dossier du spike n’est pas un dépôt Git séparé; la vérification `git ls-files` n’est donc pas applicable ici. Les règles `.gitignore` du dossier excluent `.env`, `.pnpm-store`, le cache npm, `node_modules` et les données locales Expo.

## État du test Android dans l’historique

Android natif reste **NON EXÉCUTÉ** (`java` et `adb` absents). Aucun autre essai n’est proposé dans le cadre de ce spike.

## Recommandation

**Recommandation antérieure, remplacée :** l’essai initial avait conclu que Neon Auth ne convenait pas, car il ne vérifiait qu’un JWT. La dernière tentative a ensuite démontré la validation d’une session Web côté serveur avec `auth.getSession()` et une allowlist séparée; voir la conclusion faisant foi en tête du document.
