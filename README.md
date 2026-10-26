# Dakar Tata Route Finder

Application mobile et web pour rechercher les trajets en bus Tata à Dakar.

## Développement de la base

La base principale est PostgreSQL sur Neon, avec PostGIS pour les coordonnées et les tracés géographiques. Les migrations SQL sont gérées par dbmate dans `db/migrations/`. Elles installent PostGIS, créent le catalogue et n’exposent à l’application que la vue `public.published_transit_network`.

Copiez `.env.example` vers `.env`, puis renseignez `DATABASE_URL` avec une connexion directe à une branche Neon de développement et un rôle propriétaire/migration. La connexion directe permet à dbmate d’utiliser son verrou de migration; évitez l’endpoint poolé pour les migrations. Cette URL est réservée aux commandes serveur et aux migrations : elle ne doit jamais être ajoutée aux variables Expo `EXPO_PUBLIC_*`. L’application mobile reçoit seulement `EXPO_PUBLIC_API_URL`, un endpoint HTTPS public sécurisé, et la clé publique de cartographie.

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
pnpm --filter client test
pnpm --filter @tata/domain test
pnpm exec vitest run scripts
pnpm --filter client typecheck
pnpm --filter @tata/domain typecheck
pnpm check:client-secrets
```

### Validation automatique des pull requests

Le workflow `.github/workflows/neon-db.yml` lance les tests métier, les vérifications TypeScript et l’analyse des fichiers client sans secrets. Pour les pull requests internes, le job base attend l’approbation de l’environnement GitHub `neon-validation`, puis crée une branche Neon de schéma temporaire, applique migrations et seeds, exécute pgTAP, vérifie le rollback et supprime la branche même si une étape échoue. Configurez cet environnement avec un approbateur requis et ajoutez `NEON_API_KEY` et `NEON_PROJECT_ID` comme secrets de l’environnement. Les pull requests provenant d’un fork exécutent les vérifications sans secrets ; un job indique explicitement que la validation Neon est `NOT EXECUTED`.

Le workflow masque l’URL de connexion directe générée avant de la transmettre aux commandes de validation ; il utilise la sortie `db_url`, jamais `db_url_pooled`, pour dbmate et pgTAP. L’URL ne doit pas être écrite dans les logs, les fichiers suivis par Git ni les variables Expo `EXPO_PUBLIC_*`.

## Sécurité du catalogue

Les tables sources conservent RLS activé et n’ont aucune politique de lecture publique. Le rôle API ne reçoit aucun accès direct aux tables; il peut lire uniquement la vue filtrée, qui ne renvoie que les lignes, directions, arrêts, lieux desservis, alias et formulations vérifiés et publiés. Une destination recherchée peut rester distincte de la zone desservie et du libellé affiché par le bus. Chaque direction garde son propre ordre d’arrêts.

Ne donnez jamais à l’application mobile une chaîne PostgreSQL (`DATABASE_URL`), un mot de passe Neon ou un rôle de migration. L’endpoint Expo doit pointer vers l’API HTTPS, qui valide et limite les requêtes avant de lire le catalogue avec son rôle serveur en lecture seule.
