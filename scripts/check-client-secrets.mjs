import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_EXPO_PUBLIC_VARIABLES = new Set([
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_STADIA_API_KEY',
]);

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.cmd',
  '.css',
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

const SECRET_EXPO_SUFFIX = /(?:^|_)(?:ACCESS_KEY|API_KEY|AUTH|BEARER|CREDENTIALS?|DATABASE|DB|ENCRYPTION|KEY|PASS|PASSWORD|PASSWD|PRIVATE|SECRET|SIGNING|TOKEN)(?:_|$)/i;
const SENSITIVE_ENV_REFERENCE = /\b(?:DATABASE_URL(?:_PUBLIC_API)?|PGPASSWORD|DB_PASSWORD)\b/i;
const SERVER_ONLY_ENV_REFERENCE = /\b(?:ALLOW_MEMORY_RATE_LIMIT|EXPO_PUBLIC_ALLOW_MEMORY_RATE_LIMIT|STADIA_ROUTING_API_KEY)\b/i;
const PASSWORD_VARIABLE_REFERENCE = /\b(?:PASSWORD|PASSWD|PGPASSWORD|DB_PASSWORD)\b\s*(?:=|:)\s*[^;\s,]+/i;
const POSTGRES_CONNECTION_STRING = /\bpostgres(?:ql)?:\/\//i;
const URL_WITH_CREDENTIALS = /\b[a-z][a-z\d+.-]*:\/\/[^/?#\s"'`]+:[^@/?#\s"'`]+@/i;
const EXPO_PUBLIC_VARIABLE = /\bEXPO_PUBLIC_[A-Z0-9_]+\b/gi;

const RULE_MESSAGES = Object.freeze({
  'database-url': 'Database credential variables must remain server-side.',
  'expo-public-secret': 'Sensitive Expo public variables are not allowed unless explicitly approved.',
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

  for (const match of source.matchAll(EXPO_PUBLIC_VARIABLE)) {
    const variableName = match[0].toUpperCase();
    if (ALLOWED_EXPO_PUBLIC_VARIABLES.has(variableName)) {
      continue;
    }

    const suffix = variableName.slice('EXPO_PUBLIC_'.length);
    if (SECRET_EXPO_SUFFIX.test(suffix)) {
      rules.add('expo-public-secret');
    }
  }

  return [...rules].map((rule) => ({
    file: filename,
    rule,
    message: RULE_MESSAGES[rule],
  }));
}

/**
 * Check only Expo-public assignments in environment files. Server-side variables
 * such as DATABASE_URL are deliberately ignored here, while their values are
 * never returned in findings.
 *
 * @param {string} source
 * @param {string} filename
 * @returns {{ file: string, rule: string, message: string }[]}
 */
export function findExpoPublicEnvLeaks(source, filename) {
  const rules = new Set();
  const assignment = /^\s*(?:export\s+)?(EXPO_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/i;

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(assignment);
    if (!match) {
      continue;
    }

    const [, variableName, rawValue] = match;
    const value = rawValue.replace(/^(["'])(.*)\1$/, '$2').trim();

    for (const { rule } of findClientSecretLeaks(`${variableName}=${value}`, filename)) {
      rules.add(rule);
    }

    if (
      variableName.toUpperCase() === 'EXPO_PUBLIC_API_URL' &&
      /[?#]/.test(value)
    ) {
      rules.add('public-url-query');
    }
  }

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

async function collectClientFiles(directory, appRoot, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
        continue;
      }
      await collectClientFiles(absolutePath, appRoot, files);
      continue;
    }

    if (entry.isFile() && isTextRuntimeOrConfigFile(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function collectRootEnvFiles(projectRoot) {
  const entries = await readdir(projectRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /^\.env(?:\..+)?$/.test(entry.name))
    .map((entry) => path.join(projectRoot, entry.name));
}

async function runCli() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDirectory, '..');
  const appRoot = path.join(projectRoot, 'apps', 'client');

  let clientFiles;
  let rootEnvFiles;
  try {
    clientFiles = await collectClientFiles(appRoot, appRoot);
    rootEnvFiles = await collectRootEnvFiles(projectRoot);
  } catch {
    process.stderr.write('Client secret scan failed: apps/client could not be scanned.\n');
    process.exitCode = 2;
    return;
  }

  const findings = [];
  for (const absolutePath of clientFiles) {
    let source;
    try {
      source = await readFile(absolutePath, 'utf8');
    } catch {
      process.stderr.write('Client secret scan failed: a client file could not be read.\n');
      process.exitCode = 2;
      return;
    }

    const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
    findings.push(...findClientSecretLeaks(source, relativePath));
  }

  for (const absolutePath of rootEnvFiles) {
    let source;
    try {
      source = await readFile(absolutePath, 'utf8');
    } catch {
      process.stderr.write('Client secret scan failed: a root environment file could not be read.\n');
      process.exitCode = 2;
      return;
    }

    const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
    findings.push(...findExpoPublicEnvLeaks(source, relativePath));
  }

  if (findings.length > 0) {
    for (const finding of findings) {
      process.stdout.write(`${finding.file}: ${finding.rule} — ${finding.message}\n`);
    }
    process.stderr.write(`Client secret scan failed with ${findings.length} finding(s).\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Client secret scan passed (${clientFiles.length} client file(s), ${rootEnvFiles.length} root environment file(s)).\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
