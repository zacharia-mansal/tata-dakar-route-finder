import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.cmd',
  '.css',
  '.dart',
  '.env',
  '.gradle',
  '.html',
  '.ini',
  '.js',
  '.md',
  '.mdx',
  '.json',
  '.json5',
  '.jsonc',
  '.jsx',
  '.less',
  '.mjs',
  '.plist',
  '.properties',
  '.sass',
  '.scss',
  '.sh',
  '.ps1',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.bat',
  '.yaml',
  '.yml',
]);

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.cache',
  '.expo',
  '.gradle',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'pods',
  'web-build',
]);

const SENSITIVE_ENV_REFERENCE = /\b(?:DATABASE_URL(?:_PUBLIC_API)?|PGPASSWORD|DB_PASSWORD|NEON_API_KEY|STADIA_ROUTING_API_KEY)\b/i;
const SERVER_ONLY_ENV_REFERENCE = /\b(?:ALLOW_MEMORY_RATE_LIMIT|STADIA_ROUTING_API_KEY|NEON_API_KEY)\b/i;
const PASSWORD_VARIABLE_REFERENCE = /\b(?:PASSWORD|PASSWD|PGPASSWORD|DB_PASSWORD)\b\s*(?:=|:)\s*[^;\s,]+/i;
const POSTGRES_CONNECTION_STRING = /\bpostgres(?:ql)?:\/\//i;
const URL_WITH_CREDENTIALS = /\b[a-z][a-z\d+.-]*:\/\/[^/?#\s"'`]+:[^@/?#\s"'`]+@/i;

const RULE_MESSAGES = Object.freeze({
  'database-url': 'Database credential variables must remain server-side.',
  'server-secret': 'Server credentials must remain outside the app bundle.',
  'postgres-url': 'PostgreSQL connection strings must remain server-side.',
  'public-url-query': 'Public API endpoints must not contain query parameters or fragments.',
  'secret-reference': 'Password values and references must remain server-side.',
  'server-only-env-reference': 'Server-only environment settings must not be referenced by the client.',
  'url-credentials': 'URLs containing embedded credentials must remain server-side.',
});

/**
 * Return safe, value-free findings for secrets that must not ship in the client.
 * The source text is only inspected; matching values are never included in output.
 *
 * @param {string} source
 * @param {string} filename
 * @returns {{ file: string, rule: string, message: string }[]}
 */
export function findClientSecretLeaks(source, filename) {
  const rules = new Set();

  if (SENSITIVE_ENV_REFERENCE.test(source)) {
    rules.add('database-url');
  }
  if (SERVER_ONLY_ENV_REFERENCE.test(source)) {
    rules.add('server-only-env-reference');
  }
  if (PASSWORD_VARIABLE_REFERENCE.test(source)) {
    rules.add('secret-reference');
  }
  if (POSTGRES_CONNECTION_STRING.test(source)) {
    rules.add('postgres-url');
  }
  if (URL_WITH_CREDENTIALS.test(source)) {
    rules.add('url-credentials');
  }

  if (/\b(?:DATABASE_URL(?:_PUBLIC_API)?|STADIA_ROUTING_API_KEY|NEON_API_KEY)\b/i.test(source)) rules.add('server-secret');

  return [...rules].map((rule) => ({
    file: filename,
    rule,
    message: RULE_MESSAGES[rule],
  }));
}

/**
 * Check build-time and source references for server credentials.
 *
 * @param {string} source
 * @param {string} filename
 * @returns {{ file: string, rule: string, message: string }[]}
 */
export function findAppSecretLeaks(source, filename) {
  const rules = new Set();
  for (const { rule } of findClientSecretLeaks(source, filename)) rules.add(rule);

  return [...rules].map((rule) => ({
    file: filename,
    rule,
    message: RULE_MESSAGES[rule],
  }));
}

function isTextRuntimeOrConfigFile(filename) {
  const basename = path.basename(filename).toLowerCase();
  return (
    TEXT_EXTENSIONS.has(path.extname(filename).toLowerCase()) ||
    basename === '.env' ||
    basename.startsWith('.env.')
  );
}

async function collectAppFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
        continue;
      }
      await collectAppFiles(absolutePath, files);
      continue;
    }

    if (entry.isFile() && isTextRuntimeOrConfigFile(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function runCli() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDirectory, '..');
  const appRoot = path.join(projectRoot, 'apps', 'app');

  let appFiles;
  try {
    try {
      appFiles = await collectAppFiles(appRoot);
    } catch (error) {
      if (error?.code === 'ENOENT') appFiles = [];
      else throw error;
    }
  } catch {
    process.stderr.write('App secret scan failed: apps/app could not be scanned.\n');
    process.exitCode = 2;
    return;
  }

  const findings = [];
  for (const absolutePath of appFiles) {
    let source;
    try {
      source = await readFile(absolutePath, 'utf8');
    } catch {
      process.stderr.write('App secret scan failed: an app file could not be read.\n');
      process.exitCode = 2;
      return;
    }

    const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
    findings.push(...findClientSecretLeaks(source, relativePath));
  }

  if (findings.length > 0) {
    for (const finding of findings) {
      process.stdout.write(`${finding.file}: ${finding.rule} — ${finding.message}\n`);
    }
    process.stderr.write(`App secret scan failed with ${findings.length} finding(s).\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `App secret scan passed (${appFiles.length} app file(s)).\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
