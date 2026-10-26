import crossSpawn from 'cross-spawn';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import {
  getLibpqConnectionEnvironment,
  getLibpqProcessEnvironment,
} from './postgres-connection.mjs';
import {
  extractExpectedPlanCount,
  formatPgTapSummary,
  summarizePgTapOutput,
} from './pgtap-report.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Build a pg_prove invocation that uses libpq environment variables and never
 * puts a database connection URI in process arguments or child environment.
 *
 * @param {string | undefined} databaseUrl
 * @param {string} testFile
 * @returns {{ args: string[], env: Record<string, string> }}
 */
export function getPgProveCommand(databaseUrl, testFile) {
  const connectionEnvironment = getLibpqConnectionEnvironment(
    databaseUrl,
    'DATABASE_URL is required for pgTAP validation.',
  );
  return {
    args: ['--verbose', testFile],
    env: getLibpqProcessEnvironment(connectionEnvironment),
  };
}

/**
 * Redact connection URIs and password assignments from pg_prove diagnostics.
 *
 * @param {string} output
 * @param {string} [databaseUrl]
 * @returns {string}
 */
export function redactPgProveOutput(output, databaseUrl) {
  const redactedOutput = databaseUrl
    ? output.replaceAll(databaseUrl, '[redacted database connection]')
    : output;
  return redactedOutput
    .replace(/(?:postgres|postgresql):\/\/[^\s"'<>]+/gi, '[redacted database connection]')
    .replace(/\b(password|passwd|pwd)\b\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]');
}

function runPgProve(testFile, databaseUrl) {
  return new Promise((resolve) => {
    let command;
    try {
      command = getPgProveCommand(databaseUrl, testFile);
    } catch (error) {
      resolve({ code: 1, signal: null, launchErrorCode: null, validationError: error.message, output: '' });
      return;
    }

    const child = crossSpawn('pg_prove', command.args, {
      cwd: projectRoot,
      env: command.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      resolve({ ...result, output: redactPgProveOutput(output, databaseUrl) });
    };

    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (error) => finish({ code: 1, signal: null, launchErrorCode: error.code ?? 'UNKNOWN' }));
    child.on('close', (code, signal) => finish({ code: code ?? 1, signal, launchErrorCode: null }));
  });
}

async function runCli() {
  try {
    process.loadEnvFile(join(projectRoot, '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Could not load the local environment file.');
      process.exitCode = 1;
      return;
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  try {
    getLibpqConnectionEnvironment(databaseUrl, 'DATABASE_URL is required for pgTAP validation.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const testDirectory = join(projectRoot, 'db', 'tests');
  const testFiles = (await readdir(testDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => join(testDirectory, file));

  if (testFiles.length === 0) {
    console.error('No pgTAP SQL tests found in db/tests.');
    process.exitCode = 1;
    return;
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

    const result = await runPgProve(testFile, databaseUrl);

    if (result.validationError) {
      console.error(result.validationError);
      process.exitCode = 1;
      continue;
    }

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
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runCli();
}
