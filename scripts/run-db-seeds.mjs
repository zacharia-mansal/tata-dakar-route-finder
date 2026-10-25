import crossSpawn from 'cross-spawn';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Build a psql invocation without placing the database URL in its argument list.
 *
 * @param {string} databaseUrl
 * @param {string} seedFile
 * @returns {{ args: string[], env: { PGDATABASE: string } }}
 */
export function getSeedCommand(databaseUrl, seedFile) {
  let parsedDatabaseUrl;
  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol) || !parsedDatabaseUrl.hostname) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }

  return {
    args: ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', seedFile],
    env: { PGDATABASE: databaseUrl },
  };
}

async function runCli() {
  try {
    process.loadEnvFile(join(projectRoot, '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    process.stderr.write('DATABASE_URL is required to apply database seeds.\n');
    process.exitCode = 1;
    return;
  }

  let command;
  try {
    command = getSeedCommand(databaseUrl, join(projectRoot, 'db', 'seeds', 'catalog.sql'));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  const child = crossSpawn('psql', command.args, {
    cwd: projectRoot,
    env: { ...process.env, ...command.env },
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    if (error.code === 'ENOENT') {
      process.stderr.write('psql was not found. Install PostgreSQL client tools first.\n');
    } else {
      process.stderr.write('Could not start psql to apply database seeds.\n');
    }
    process.exitCode = 1;
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.stderr.write(`psql stopped with signal ${signal}.\n`);
      process.exitCode = 1;
    } else {
      process.exitCode = code ?? 1;
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runCli();
}
