import { describe, expect, it } from 'vitest';
import { getSeedCommand } from './run-db-seeds.mjs';

describe('getSeedCommand', () => {
  it('passes the seed file to psql and keeps the connection URL in the environment', () => {
    const databaseUrl = ['postgresql:', '/', '/', 'test-user:test-password@db.example.invalid/catalog'].join('');
    const seedFile = 'C:/workspace/db/seeds/catalog.sql';

    expect(getSeedCommand(databaseUrl, seedFile)).toEqual({
      args: ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', seedFile],
      env: { PGDATABASE: databaseUrl },
    });
  });

  it('rejects non-PostgreSQL URLs', () => {
    expect(() => getSeedCommand('https://example.test', 'catalog.sql')).toThrow(
      'DATABASE_URL must be a PostgreSQL connection URL.',
    );
  });

  it('rejects malformed PostgreSQL URLs', () => {
    expect(() => getSeedCommand(['postgres:', '/', '/'].join(''), 'catalog.sql')).toThrow(
      'DATABASE_URL must be a PostgreSQL connection URL.',
    );
  });

  it('rejects a PostgreSQL URL with a username but no host', () => {
    const databaseUrl = ['postgres:', '/', '/', 'seed-user:seed-password@/catalog'].join('');
    expect(() => getSeedCommand(databaseUrl, 'catalog.sql')).toThrow(
      'DATABASE_URL must be a PostgreSQL connection URL.',
    );
  });
});
