# Première validation de la CI Neon — Task 2

Cette checklist prépare la première exécution du workflow `neon-db.yml`. Ne mettez jamais une clé ou une URL de connexion dans un fichier du dépôt, dans Expo ou dans un message de log.

## A. Créer le projet Neon Tata

- Créer un projet Neon dédié à Tata dans la région choisie pour le service.
- Récupérer l’identifiant du projet depuis la console Neon.
- Créer une clé API limitée à ce projet et aux opérations nécessaires à la création et à la suppression des branches temporaires de validation, si Neon permet de limiter ainsi la portée.
- Garder ces deux valeurs dans le gestionnaire de secrets GitHub seulement. Ne pas les coller dans le dépôt ni dans Expo.

## B. Créer le dépôt GitHub privé et préparer la branche

- Créer un dépôt GitHub privé pour `tata-dakar-route-finder`.
- Configurer le remote local `origin` pour ce dépôt, puis pousser la branche `task-2-neon-validation` avec la commande exacte donnée à la section F.

## C. Créer l’environnement et ses secrets

Dans **Settings → Environments**, créer l’environnement nommé exactement `neon-validation`.

- Ajouter au moins un approbateur requis.
- Ajouter ces deux secrets d’environnement, avec ces noms exacts :
  - `NEON_API_KEY`
  - `NEON_PROJECT_ID`
- Limiter si possible les branches autorisées à déployer vers cet environnement à la branche de validation attendue.
- Ne pas créer de variable `DATABASE_URL` dans GitHub : le workflow la reçoit uniquement de la branche Neon temporaire et masque sa valeur avant les commandes de base.

## D. Ouvrir et approuver la pull request

- Ouvrir une pull request de `task-2-neon-validation` vers la branche par défaut du dépôt.
- Attendre la réussite du job `App and domain checks`.
- Pour une pull request provenant du dépôt privé Tata, approuver le job `Neon migrations, seeds, rollback, and pgTAP` dans l’environnement `neon-validation`.
- Pour une pull request issue d’un fork, le job `Neon validation NOT EXECUTED for fork pull requests` doit indiquer clairement que les tests Neon n’ont pas été exécutés ; aucun secret n’est transmis au fork.

## E. Lire le résultat et diagnostiquer les échecs probables

Le job Neon doit afficher le statut des migrations, exécuter migrations, seeds et pgTAP, annuler la dernière migration, la réappliquer, relancer la validation et supprimer la branche temporaire. Le runner pgTAP affiche pour chaque fichier le nombre d’assertions exécutées, le plan TAP, le nombre déclaré dans `plan()` et le nombre d’échecs.

| Étape en échec | Cause probable à vérifier |
|---|---|
| Secrets ou création de branche | Nom d’environnement ou nom de secret incorrect ; clé API Neon sans accès au projet ; projet inexistant ou branche temporaire impossible à créer. |
| Installation de PostGIS | Neon peut refuser `CREATE EXTENSION postgis WITH SCHEMA extensions` si l’extension est déjà installée dans un autre schéma ou si cette version ne permet pas de l’installer dans `extensions`. Les assertions pgTAP vérifient que `extensions.geometry` et `extensions.geography` existent et fonctionnent comme la vue les qualifie. Ne changez pas la vue pour masquer cet échec : examinez d’abord le message Neon et le schéma réel de l’extension. |
| Installation de pgTAP / `pg_prove` | Installation Perl interrompue, module `TAP::Parser::SourceHandler::pgTAP` absent, extension pgTAP non disponible sur la branche ou droits insuffisants pour la créer dans les tests. Elle est créée dans `db/tests/`, jamais par une migration de production. |
| Tests pgTAP | Le rôle lecteur a reçu un privilège excessif ; une ligne brouillon, candidate ou rejetée fuit dans la vue ; une assertion échoue ; ou les nombres `plan()`, plan TAP et assertions exécutées ne concordent pas. |
| Rollback puis revalidation | La migration `down` n’annule pas tous ses objets/droits, la réapplication n’est pas idempotente ou le seed n’est pas rejouable. La branche est temporaire ; ne relancez pas cette séquence sur la branche Neon principale. |
| Suppression de branche | L’action Neon n’a pas pu joindre le projet ou supprimer la branche. L’expiration automatique est une protection secondaire, pas un résultat de suppression confirmé. |

Un échec du contrôle `pnpm install --frozen-lockfile` indique généralement que le lockfile et les manifests de workspace ne sont pas alignés. Un échec de TypeScript, Vitest ou du scan client doit être corrigé avant d’interpréter les résultats Neon.

## F. Commande PowerShell pour pousser la branche

Depuis la racine du dépôt, après avoir configuré `origin` vers le dépôt GitHub privé :

```powershell
git push --set-upstream origin task-2-neon-validation
```
