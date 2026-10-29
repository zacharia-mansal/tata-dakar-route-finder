import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

const workflowSource = readFileSync(
  new URL('../.github/workflows/neon-db.yml', import.meta.url),
  'utf8',
);
const workflow = load(workflowSource);
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const dbTestRunner = readFileSync(new URL('./run-db-tests.mjs', import.meta.url), 'utf8');
const postgresConnection = readFileSync(new URL('./postgres-connection.mjs', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const firstRunChecklist = readFileSync(new URL('../docs/ci-first-run-checklist.md', import.meta.url), 'utf8');
const projectRoot = new URL('..', import.meta.url);
const workspaceManifest = load(readFileSync(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8'));

describe('Neon workflow security and reliability', () => {
  it('parses valid YAML and keeps status functions and step references in valid contexts', () => {
    const parsedWorkflow = load(workflowSource);
    const misplacedStatusFunctions = [];
    const missingStepReferences = [];

    const visitStrings = (value, path, onString) => {
      if (typeof value === 'string') {
        onString(value, path);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => visitStrings(item, `${path}[${index}]`, onString));
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          visitStrings(child, path ? `${path}.${key}` : key, onString);
        }
      }
    };

    visitStrings(parsedWorkflow, '', (value, path) => {
      if (/\b(?:always|cancelled|success|failure)\s*\(/.test(value) && !path.endsWith('.if')) {
        misplacedStatusFunctions.push(path);
      }
    });

    for (const [jobId, job] of Object.entries(parsedWorkflow.jobs)) {
      const stepIds = (job.steps ?? []).map((step) => step.id).filter(Boolean);
      expect(new Set(stepIds).size, `step ids must be unique in job ${jobId}`).toBe(stepIds.length);
      const knownStepIds = new Set(stepIds);

      visitStrings(job, `jobs.${jobId}`, (value, path) => {
        for (const match of value.matchAll(/\bsteps\.([A-Za-z_][A-Za-z0-9_-]*)\./g)) {
          if (!knownStepIds.has(match[1])) missingStepReferences.push(`${path}: ${match[1]}`);
        }
      });
    }

    expect(misplacedStatusFunctions).toEqual([]);
    expect(missingStepReferences).toEqual([]);
  });

  it('runs on pull_request only and explicitly marks fork database validation as skipped', () => {
    expect(workflow.on.pull_request).toBeTruthy();
    expect(workflow.on.pull_request_target).toBeUndefined();
    expect(workflow.jobs['neon-db'].if).toContain('head.repo.full_name == github.repository');
    expect(workflow.jobs['neon-db-fork']).toBeTruthy();
    expect(workflow.jobs['neon-db-fork'].if).toContain('head.repo.full_name != github.repository');
    expect(workflow.jobs['neon-db-fork'].steps.map((step) => step.run ?? '').join('\n')).toMatch(/NOT EXECUTED/i);
    expect(workflow.jobs['neon-db-fork'].steps.every((step) => !step.env?.NEON_API_KEY && !step.env?.NEON_PROJECT_ID)).toBe(true);
  });

  it('runs secret-free workspace validation on every pull request, including forks', () => {
    const job = workflow.jobs['workspace-validation'];

    expect(job).toBeTruthy();
    expect(job.if).toBeUndefined();
    expect(job.needs).toBeUndefined();
    expect(job.environment).toBeUndefined();
    expect(job.permissions).toEqual({ contents: 'read' });

    const serializedJob = JSON.stringify(job);
    expect(serializedJob).not.toMatch(/secrets\.|\bNEON_[A-Z0-9_]+\b|\bDATABASE_URL\b|\bSTADIA_ROUTING_API_KEY\b/i);

    const commands = job.steps.filter((step) => step.run).map((step) => step.run.trim());
    expect(commands).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm -r typecheck',
      'pnpm typecheck',
      'pnpm exec vitest run',
      'pnpm check:app-secrets',
    ]);
  });

  it('does not run commands for the removed Expo client in CI', () => {
    const commands = Object.values(workflow.jobs)
      .flatMap((job) => job.steps ?? [])
      .map((step) => step.run ?? '')
      .join('\n');

    expect(commands).not.toMatch(/pnpm\s+--filter\s+client\b/i);
    expect(commands).not.toMatch(/pnpm\s+check:client-secrets\b/i);
    expect(commands).not.toMatch(/apps\/client/i);
  });

  it('pins each remaining external action to a 40-character commit SHA', () => {
    const uses = Object.values(workflow.jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.uses)
      .map((step) => step.uses);

    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) {
      expect(action).toMatch(/^[^@]+@[0-9a-f]{40}(?:\s+#.*)?$/i);
    }

    expect(uses.filter((action) => action === 'pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413').length).toBe(3);
    expect(uses).toContain('neondatabase/create-branch-action@153375631fc0f99cf0113e0cef877850452e6ca2');
    expect(uses.some((action) => action.startsWith('neondatabase/delete-branch-action@'))).toBe(false);
    expect(uses).toContain('actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683');
    expect(uses).toContain('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020');
  });

  it('uses the documented pinned action inputs and outputs', () => {
    const allSteps = Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);
    const pnpmSteps = allSteps.filter((step) => step.uses?.startsWith('pnpm/action-setup@'));
    const createBranch = workflow.jobs['neon-db'].steps.find((step) => step.id === 'neon');
    const deleteBranch = workflow.jobs['neon-db'].steps.find((step) => step.name?.includes('Delete temporary Neon branch'));

    expect(pnpmSteps).toHaveLength(3);
    expect(pnpmSteps.every((step) => !Object.hasOwn(step.with ?? {}, 'version'))).toBe(true);
    expect(createBranch.with).toMatchObject({
      project_id: '${{ secrets.NEON_PROJECT_ID }}',
      api_key: '${{ secrets.NEON_API_KEY }}',
      branch_type: 'schema-only',
      ssl: 'require',
    });
    expect(createBranch.with).not.toHaveProperty('expires_at');
    expect(deleteBranch.env.NEON_BRANCH_ID).toBe('${{ steps.neon.outputs.branch_id }}');
    expect(deleteBranch.env.NEON_API_KEY).toBe('${{ secrets.NEON_API_KEY }}');
    expect(deleteBranch.env.NEON_PROJECT_ID).toBe('${{ secrets.NEON_PROJECT_ID }}');
    expect(deleteBranch.run).toMatch(/method:\s*'DELETE'/);
    expect(deleteBranch.run).toMatch(/https:\/\/console\.neon\.tech\/api\/v2\/projects\/\$\{encodeURIComponent\(projectId\)\}\/branches\/\$\{encodeURIComponent\(branchId\)\}/);
    expect(deleteBranch.run).toMatch(/authorization:\s*`Bearer \$\{apiKey\}`/i);
    expect(deleteBranch.run).toMatch(/response\.status\s*!==\s*200/);
    expect(deleteBranch.run).not.toMatch(/\b204\b/);
    expect(deleteBranch.run).not.toContain('${{ secrets.NEON_API_KEY }}');
    expect(deleteBranch.run).not.toMatch(/console\.log|console\.error\(.*apiKey/i);
    expect(deleteBranch).not.toHaveProperty('uses');
    expect(workflow.jobs['neon-db'].steps.some((step) => step.env?.DATABASE_URL === '${{ steps.neon.outputs.db_url }}')).toBe(true);
  });

  it('uses minimal permissions, per-PR concurrency, and job timeouts', () => {
    expect(workflow.permissions).toEqual({});
    expect(workflow.jobs['app-checks'].permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs['neon-db'].permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency['cancel-in-progress']).toBe(true);
    expect(workflow.concurrency.group).toContain('pull_request.number');
    for (const job of Object.values(workflow.jobs)) {
      expect(job['timeout-minutes']).toBeGreaterThan(0);
    }
    expect(workflow.jobs['neon-db'].environment).toBe('neon-validation');
  });

  it('masks the direct Neon URL before passing it to database commands and always deletes the branch', () => {
    const steps = workflow.jobs['neon-db'].steps;
    const maskIndex = steps.findIndex((step) => step.name?.includes('Mask generated Neon connection URL'));
    const databaseStepIndexes = steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.env?.DATABASE_URL)
      .map(({ index }) => index);
    const deleteStep = steps.find((step) => step.name?.includes('Delete temporary Neon branch'));

    expect(maskIndex).toBeGreaterThan(-1);
    expect(databaseStepIndexes.length).toBeGreaterThan(0);
    expect(databaseStepIndexes.every((index) => index > maskIndex)).toBe(true);
    expect(steps.some((step) => step.env?.DATABASE_URL === '${{ steps.neon.outputs.db_url_with_pooler }}')).toBe(false);
    expect(deleteStep.if).toMatch(/always\(\).*steps\.neon\.outputs\.branch_id/);
    expect(deleteStep.env.NEON_BRANCH_ID).toBe('${{ steps.neon.outputs.branch_id }}');
    expect(deleteStep['continue-on-error']).toBe("${{ job.status == 'failure' }}");
    expect(deleteStep.run).toMatch(/if \(!branchId\) process\.exit\(0\)/);

    const rollbackIndex = steps.findIndex((step) => step.name?.includes('Roll back temporary branch'));
    const validateIndex = steps.findIndex((step) => step.name?.includes('Apply migrations, seeds, and pgTAP tests'));
    expect(rollbackIndex).toBeGreaterThan(validateIndex);
    expect(steps[rollbackIndex].run).toMatch(/pnpm db:rollback[\s\S]*pnpm db:validate/);
    expect(steps[rollbackIndex].env.DATABASE_URL).toBe('${{ steps.neon.outputs.db_url }}');

    const databaseSteps = steps.filter((step) => /pnpm db:(?:status|migrate|seed|test|validate|rollback)/.test(step.run ?? ''));
    expect(databaseSteps.length).toBe(3);
    expect(databaseSteps.every((step) => step.env?.DATABASE_URL === '${{ steps.neon.outputs.db_url }}')).toBe(true);
  });

  it('documents exact GitHub secret names and direct versus pooled connection usage', () => {
    expect(readme).toContain('NEON_API_KEY');
    expect(readme).toContain('NEON_PROJECT_ID');
    expect(workflow.jobs['neon-db'].environment).toBe('neon-validation');
    expect(readme).toMatch(/connexion directe[\s\S]*?pool/i);
    expect(readme).toContain('Valider le schéma de la base');
    expect(readme).not.toContain('Valider la Task 2');
  });

  it('reports actual pgTAP assertion counts against each SQL plan', () => {
    expect(dbTestRunner).toContain('extractExpectedPlanCount');
    expect(dbTestRunner).toContain('summarizePgTapOutput');
    expect(dbTestRunner).toContain('formatPgTapSummary');
    expect(dbTestRunner).toMatch(/--verbose|\-v/);
  });

  it('does not pass ambient secret environment variables to pg_prove', () => {
    expect(dbTestRunner).not.toMatch(/\.\.\.process\.env/);
    expect(dbTestRunner).toContain('getLibpqConnectionEnvironment');
    expect(postgresConnection).toMatch(/PGDATABASE:\s*database/);
    expect(postgresConnection).toMatch(/PGHOST:\s*host\.replace/);
    expect(postgresConnection).toMatch(/PGPASSWORD/);
    expect(postgresConnection).toMatch(/PGSSLMODE/);
  });

  it('documents the Neon first-run checklist and the exact local push command', () => {
    expect(firstRunChecklist).toContain('NEON_API_KEY');
    expect(firstRunChecklist).toContain('NEON_PROJECT_ID');
    expect(firstRunChecklist).toContain('neon-validation');
    expect(firstRunChecklist).toContain('PostGIS');
    expect(firstRunChecklist).toContain('git push --set-upstream origin task-2-neon-validation');
  });
});

describe('repository hygiene and lockfile consistency', () => {
  it('has LF text attributes and ignores local connection and pnpm-store files', () => {
    const attributes = readFileSync(new URL('../.gitattributes', import.meta.url), 'utf8');
    expect(attributes).toMatch(/^\* text=auto eol=lf$/m);

    for (const localPath of ['.env', '.env.local', '.pnpm-store']) {
      const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', localPath], {
        cwd: projectRoot,
      });
      expect(result.status, `${localPath} should be ignored`).toBe(0);
    }

    const tracked = execFileSync('git', ['ls-files'], { cwd: projectRoot, encoding: 'utf8' });
    const trackedPaths = tracked.split(/\r?\n/).filter(Boolean);
    const trackedLocalEnvFiles = trackedPaths.filter((filePath) => /(?:^|\/)\.env(?:\.[^/]+)?$/.test(filePath)
      && filePath !== '.env.example');
    expect(trackedLocalEnvFiles).toEqual([]);
    expect(trackedPaths.some((filePath) => filePath.includes('.pnpm-store/'))).toBe(false);
  });

  it('keeps the tracked environment template free of a populated database URL', () => {
    const populatedDatabaseUrl = new RegExp(`^\\s*${['DATABASE', '_URL'].join('')}\\s*=\\s*[^\\s#]+`, 'im');
    expect(envExample).not.toMatch(populatedDatabaseUrl);
    const postgresScheme = new RegExp(['postgres', '(?:ql)?:', '\\/\\/'].join(''), 'i');
    expect(envExample).not.toMatch(postgresScheme);
  });

  it('keeps workspace dependency manifests represented in the pnpm lockfile', () => {
    const yaml = load(readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'));
    const workspaces = [
      ['.', '../package.json'],
      ['apps/api', '../apps/api/package.json'],
      ['packages/domain', '../packages/domain/package.json'],
    ];

    expect(workspaceManifest.packages).toContain('apps/*');
    expect(yaml.importers['apps/api']).toBeTruthy();
    expect(yaml.importers['apps/client']).toBeUndefined();
    expect(existsSync(new URL('../apps/client', import.meta.url))).toBe(false);

    const apiManifest = JSON.parse(readFileSync(new URL('../apps/api/package.json', import.meta.url), 'utf8'));
    expect(JSON.stringify(apiManifest)).not.toMatch(/apps\/client|workspace:[^"\s]*client/i);

    for (const [importerName, manifestUrl] of workspaces) {
      const manifest = JSON.parse(readFileSync(new URL(manifestUrl, import.meta.url), 'utf8'));
      const importer = yaml.importers[importerName];
      expect(importer, `${importerName} lockfile importer exists`).toBeTruthy();

      for (const dependencyType of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        for (const [dependencyName, specifier] of Object.entries(manifest[dependencyType] ?? {})) {
          expect(importer[dependencyType]?.[dependencyName]?.specifier).toBe(specifier);
        }
      }
    }
  });
});
