import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';

const workflow = load(readFileSync(
  new URL('../.github/workflows/neon-db.yml', import.meta.url),
  'utf8',
));
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const dbTestRunner = readFileSync(new URL('./run-db-tests.mjs', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const firstRunChecklist = readFileSync(new URL('../docs/ci-first-run-checklist.md', import.meta.url), 'utf8');
const projectRoot = new URL('..', import.meta.url);

describe('Neon workflow security and reliability', () => {
  it('runs on pull_request only and explicitly marks fork database validation as skipped', () => {
    expect(workflow.on.pull_request).toBeTruthy();
    expect(workflow.on.pull_request_target).toBeUndefined();
    expect(workflow.jobs['neon-db'].if).toContain('head.repo.full_name == github.repository');
    expect(workflow.jobs['neon-db-fork']).toBeTruthy();
    expect(workflow.jobs['neon-db-fork'].if).toContain('head.repo.full_name != github.repository');
    expect(workflow.jobs['neon-db-fork'].steps.map((step) => step.run ?? '').join('\n')).toMatch(/NOT EXECUTED/i);
    expect(workflow.jobs['neon-db-fork'].steps.every((step) => !step.env?.NEON_API_KEY && !step.env?.NEON_PROJECT_ID)).toBe(true);
  });

  it('pins each external action to a full commit SHA or an exact semantic version', () => {
    const uses = Object.values(workflow.jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.uses)
      .map((step) => step.uses);

    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) {
      expect(action).toMatch(/^[^@]+@(?:[0-9a-f]{40}|v\d+\.\d+\.\d+)(?:\s+#.*)?$/i);
    }
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
    expect(steps.some((step) => step.env?.['DATABASE' + '_URL'] === '${{ steps.neon.outputs.db_url_pooled }}')).toBe(false);
    expect(deleteStep.if).toMatch(/always\(\).*steps\.neon\.outputs\.branch_id/);
    expect(deleteStep.with.branch).toBe('${{ steps.neon.outputs.branch_id }}');

    const rollbackIndex = steps.findIndex((step) => step.name?.includes('Roll back temporary branch'));
    const validateIndex = steps.findIndex((step) => step.name?.includes('Apply migrations, seeds, and pgTAP tests'));
    expect(rollbackIndex).toBeGreaterThan(validateIndex);
    expect(steps[rollbackIndex].run).toMatch(/pnpm db:rollback[\s\S]*pnpm db:validate/);
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
    expect(dbTestRunner).toMatch(/PGDATABASE:\s*databaseUrl/);
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
    expect(tracked).not.toMatch(/(?:^|\/)\.env(?:\.|$)/m);
    expect(tracked).not.toContain('.pnpm-store/');
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
      ['apps/client', '../apps/client/package.json'],
      ['packages/domain', '../packages/domain/package.json'],
    ];

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
