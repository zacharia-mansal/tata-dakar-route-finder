import { describe, expect, it } from 'vitest';
import { getSeedCommand } from './run-db-seeds.mjs';

describe('getSeedCommand', () => {
  it('passes the seed file and maps the connection URL into libpq environment variables', () => {
    const databaseUrl = ['postgresql:', '/', '/', 'seed-user:seed-pass@db.example.invalid:5432/catalog?sslmode=require&channel_binding=require'].join('');
    const seedFile = 'C:/workspace/db/seeds/catalog.sql';

    const command = getSeedCommand(databaseUrl, seedFile);
    expect(command.args).toEqual(['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', seedFile]);
    expect(command.env).toEqual({
      PGHOST: 'db.example.invalid',
      PGPORT: '5432',
      PGDATABASE: 'catalog',
      PGUSER: 'seed-user',
      PGPASSWORD: 'seed-pass',
      PGSSLMODE: 'require',
      PGCHANNELBINDING: 'require',
    });
    expect(command.args).not.toContain(databaseUrl);
    expect(command.args.join(' ')).not.toContain('seed-pass');
    expect(Object.values(command.env)).not.toContain(databaseUrl);
  });

  it('rejects a missing DATABASE_URL with a clear message that contains no value', () => {
    expect(() => getSeedCommand(undefined, 'catalog.sql')).toThrow('DATABASE_URL is required to apply database seeds.');
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
