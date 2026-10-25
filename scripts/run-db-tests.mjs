import crossSpawn from 'cross-spawn';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import {
  extractExpectedPlanCount,
  formatPgTapSummary,
  summarizePgTapOutput,
} from './pgtap-report.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(join(projectRoot, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('Could not load the local environment file.');
    process.exit(1);
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required for pgTAP validation.');
  process.exit(1);
}

let parsedDatabaseUrl;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  console.error('DATABASE_URL must be a PostgreSQL connection URL.');
  process.exit(1);
}

if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
  console.error('DATABASE_URL must use the postgres:// or postgresql:// scheme.');
  process.exit(1);
}

const testDirectory = join(projectRoot, 'db', 'tests');
const testFiles = (await readdir(testDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => join(testDirectory, file));

if (testFiles.length === 0) {
  console.error('No pgTAP SQL tests found in db/tests.');
  process.exit(1);
}

function redactPgProveOutput(output) {
  return output
    .replaceAll(databaseUrl, '[redacted database connection]')
    .replace(/(?:postgres|postgresql):\/\/[^\s"'<>]+/gi, '[redacted database connection]')
    .replace(/\b(password|passwd|pwd)\b\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]');
}

function runPgProve(testFile) {
  return new Promise((resolve) => {
    const childEnv = { PATH: process.env.PATH ?? '', PGDATABASE: databaseUrl };
    for (const key of ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'PERL5LIB']) {
      if (process.env[key]) childEnv[key] = process.env[key];
    }

    const child = crossSpawn('pg_prove', ['--verbose', testFile], {
      cwd: projectRoot,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      resolve({ ...result, output: redactPgProveOutput(output) });
    };

    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => finish({ code: 1, signal: null, launchErrorCode: error.code ?? 'UNKNOWN' }));
    child.on('close', (code, signal) => finish({ code: code ?? 1, signal, launchErrorCode: null }));
  });
}

for (const testFile of testFiles) {
  const fileName = basename(testFile);
  let expected;

  try {
    expected = extractExpectedPlanCount(await readFile(testFile, 'utf8'));
  } catch (error) {
    console.error(`Could not read the pgTAP plan in ${fileName}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }

  const result = await runPgProve(testFile);

  if (result.launchErrorCode === 'ENOENT') {
    console.error('pg_prove was not found. Install pgTAP client tools and PostgreSQL psql first.');
    process.exitCode = 1;
    continue;
  }

  if (result.launchErrorCode) {
    console.error(`Could not start pg_prove (process error ${result.launchErrorCode}).`);
    process.exitCode = 1;
    continue;
  }

  const report = summarizePgTapOutput(result.output, expected);
  console.log(formatPgTapSummary(fileName, report));

  if (result.signal || result.code !== 0 || !report.consistent) {
    if (result.signal) console.error(`pg_prove stopped with signal ${result.signal}.`);
    if (result.code !== 0) console.error(`pg_prove exited with status ${result.code}.`);
    if (!report.consistent) console.error(`pgTAP plan mismatch in ${fileName}.`);
    if (result.output.trim()) console.error(result.output);
    process.exitCode = 1;
  }
}
