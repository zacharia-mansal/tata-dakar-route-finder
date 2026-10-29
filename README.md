# Dakar Tata Route Finder

API et domaine partagé pour rechercher les trajets en bus Tata à Dakar. Le client Expo a été retiré ; le futur client Flutter sera préparé dans une PR distincte et n’est pas créé ici.

## Développement de la base

La base principale est PostgreSQL sur Neon, avec PostGIS pour les coordonnées et les tracés géographiques. Les migrations SQL sont gérées par dbmate dans `db/migrations/`. Elles installent PostGIS, créent le catalogue et n’exposent à l’application que la vue `public.published_transit_network`.

Copiez `.env.example` vers `.env`, puis renseignez `DATABASE_URL` avec une connexion directe à une branche Neon de développement et un rôle propriétaire/migration. La connexion directe permet à dbmate d’utiliser son verrou de migration; évitez l’endpoint poolé pour les migrations. Cette URL est réservée aux commandes serveur et aux migrations : elle ne doit jamais être intégrée à l’application. Le futur client Flutter utilisera `--dart-define` uniquement pour des paramètres publics, jamais pour un secret.

Installez dbmate, le client PostgreSQL (`psql`) et `pg_prove` avec le support pgTAP, puis utilisez :

```sh
pnpm db:status
pnpm db:migrate
pnpm db:test
pnpm db:validate
```

`db:validate` applique les migrations en attente, exécute le seed contrôlé, puis tous les scripts pgTAP de `db/tests/`. Les tests requièrent une base PostgreSQL de développement avec PostGIS et le rôle `tata_catalog_reader`. Le rôle est sans connexion et ne peut lire que la vue publiée. Ils se connectent avec le rôle propriétaire/migration, nécessaire pour créer les fixtures et faire le `SET ROLE` de test. Le service API serveur doit utiliser un rôle de connexion dédié membre de `tata_catalog_reader`; gardez son URL de connexion et tout secret uniquement dans l’environnement serveur.

Le rollback retire la vue et ses droits d’accès, mais conserve le rôle de groupe `tata_catalog_reader` afin de ne pas casser les appartenances des rôles serveur. Le rôle est alors sans accès au catalogue et sera réutilisé si la migration est réappliquée.

Les scripts pgTAP installent temporairement l’extension `pgtap` si nécessaire et annulent leurs données de test dans une transaction. Neon prend en charge PostGIS et pgTAP; exécutez les migrations et tests sur une branche de développement avant de promouvoir le schéma. Les seeds restent volontairement vides jusqu’à la vérification terrain des arrêts, directions et formulations à demander au receveur.

## Valider le schéma de la base

### Windows avec PowerShell

Lancez ces commandes depuis la racine du dépôt. Le store pnpm reste dans le projet et est ignoré par Git :

```powershell
pnpm config set store-dir .pnpm-store --location project
git check-ignore .pnpm-store
pnpm install --frozen-lockfile
```

Installez les outils, puis ouvrez un nouveau PowerShell :

```powershell
npm install --global dbmate@2.37.0
winget install --id PostgreSQL.PostgreSQL.18 --exact --accept-source-agreements --accept-package-agreements
winget install --id StrawberryPerl.StrawberryPerl --exact --accept-source-agreements --accept-package-agreements
```

Si WinGet n’est pas disponible, installez PostgreSQL depuis [la page officielle des installateurs Windows](https://www.postgresql.org/download/windows/) et Strawberry Perl depuis [son site officiel](https://strawberryperl.com/). Si le dossier `bin` de PostgreSQL n’est pas déjà dans `PATH`, adaptez cette commande à la version installée :

```powershell
$env:Path += ';C:\Program Files\PostgreSQL\18\bin'
cpan TAP::Parser::SourceHandler::pgTAP
```

Vérifiez les outils sans afficher la configuration de connexion :

```powershell
node --version
pnpm --version
dbmate --version
psql --version
pg_prove --version
git --version
```

Préparez `.env` localement, renseignez-y une connexion directe vers une **branche Neon de développement jetable**, puis lancez :

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
pnpm db:status
pnpm db:validate
```

Pour vérifier le rollback, restez sur cette branche jetable et exécutez :

```powershell
pnpm db:rollback
pnpm db:validate
```

La validation complète côté application se lance séparément :

```powershell
pnpm --filter @tata/domain test
pnpm exec vitest run scripts
pnpm --filter @tata/domain typecheck
pnpm check:app-secrets
```

### Validation automatique des pull requests

Le workflow `.github/workflows/neon-db.yml` lance les tests métier, les vérifications TypeScript et l’analyse des fichiers de l’application sans secrets. Pour les pull requests internes, le job base attend l’approbation de l’environnement GitHub `neon-validation`, puis crée une branche Neon de schéma temporaire, applique migrations et seeds, exécute pgTAP, vérifie le rollback et supprime la branche même si une étape échoue. Configurez cet environnement avec un approbateur requis et ajoutez `NEON_API_KEY` et `NEON_PROJECT_ID` comme secrets de l’environnement. Les pull requests provenant d’un fork exécutent les vérifications sans secrets ; un job indique explicitement que la validation Neon est `NOT EXECUTED`.

Le workflow masque l’URL de connexion directe générée avant de la transmettre aux commandes de validation ; il utilise la sortie `db_url`, jamais `db_url_pooled`, pour dbmate et pgTAP. L’URL ne doit pas être écrite dans les logs, les fichiers suivis par Git ni dans les paramètres de compilation du client Flutter.

## Sécurité du catalogue

Les tables sources conservent RLS activé et n’ont aucune politique de lecture publique. Le rôle API ne reçoit aucun accès direct aux tables; il peut lire uniquement la vue filtrée, qui ne renvoie que les lignes, directions, arrêts, lieux desservis, alias et formulations vérifiés et publiés. Une destination recherchée peut rester distincte de la zone desservie et du libellé affiché par le bus. Chaque direction garde son propre ordre d’arrêts.

Ne donnez jamais à l’application mobile une chaîne PostgreSQL (`DATABASE_URL`), un mot de passe Neon ou un rôle de migration. Le client Flutter pointera vers l’API HTTPS, qui valide et limite les requêtes avant de lire le catalogue avec son rôle serveur en lecture seule.

## Créer le rôle de connexion de l’API

Le rôle `tata_public_api` est créé manuellement par un propriétaire de la base, après application des migrations. Aucune migration ne le crée. Il doit seulement hériter des droits de lecture de `tata_catalog_reader` et lire la vue publiée ; il ne reçoit pas de droits directs sur les tables du catalogue.

Exécutez une seule fois le SQL suivant dans la bonne base Neon. La limite `10` est un exemple, pas une valeur décidée : remplacez-la par la limite de connexions retenue pour le compute et la concurrence attendue de Vercel.

```sql
CREATE ROLE tata_public_api LOGIN;
GRANT tata_catalog_reader TO tata_public_api;
ALTER ROLE tata_public_api CONNECTION LIMIT 10;
ALTER ROLE tata_public_api SET statement_timeout = '4s';
ALTER ROLE tata_public_api SET lock_timeout = '1s';
```

Définissez le mot de passe séparément au moyen d’un parcours sécurisé, par exemple avec la commande interactive `\password tata_public_api` dans `psql`. N’écrivez jamais le mot de passe dans le dépôt, une migration, une commande journalisée ou un message. La connexion poolée de ce rôle est stockée uniquement dans la variable serveur Vercel `DATABASE_URL_PUBLIC_API`, jamais dans Expo.

`statement_timeout` arrête une instruction SQL qui dépasse quatre secondes ; `lock_timeout` limite à une seconde chaque attente de verrou. Ces délais complètent l’échéance applicative de dix secondes. Les valeurs configurées par `ALTER ROLE ... SET` s’appliquent lors de l’ouverture d’une nouvelle session : après une modification, ouvrez une nouvelle connexion. Neon utilise PgBouncer en mode transaction pour les connexions poolées ; ne comptez pas sur un `SET` de session envoyé dans une requête pour survivre à la transaction suivante. Contrôlez les valeurs effectives en vous connectant avec `tata_public_api` via la connexion poolée utilisée par l’API :

```sql
SELECT
  current_user AS role_name,
  pg_catalog.current_setting('statement_timeout') AS statement_timeout,
  pg_catalog.current_setting('lock_timeout') AS lock_timeout,
  pg_catalog.pg_has_role(current_user, 'tata_catalog_reader', 'MEMBER') AS is_catalog_reader,
  role_row.rolconnlimit AS connection_limit
FROM pg_catalog.pg_roles AS role_row
WHERE role_row.rolname = current_user;
```

La requête doit retourner `tata_public_api`, les délais attendus, l’appartenance au rôle lecteur et la limite de connexions choisie. Les tests pgTAP de `db/tests/transit_catalog_rls.test.sql` vérifient les droits sur la vue et les tables sources. Références : [Neon — Connection pooling](https://neon.com/docs/connect/connection-pooling), [PostgreSQL — ALTER ROLE](https://www.postgresql.org/docs/current/sql-alterrole.html), [PostgreSQL — délais de requête et de verrou](https://www.postgresql.org/docs/current/runtime-config-client.html).
