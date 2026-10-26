import { describe, expect, it } from 'vitest';
import { getPgProveCommand, redactPgProveOutput } from './run-db-tests.mjs';

describe('getPgProveCommand', () => {
  it('transmits parsed libpq connection settings through the process environment only', () => {
    const databaseUrl = ['postgresql:', '/', '/', 'tap-user:tap-pass@db.example.invalid:5432/catalog?sslmode=require&channel_binding=require'].join('');
    const testFile = 'C:/workspace/db/tests/catalog.test.sql';
    const command = getPgProveCommand(databaseUrl, testFile);

    expect(command.args).toEqual(['--verbose', testFile]);
    expect(command.env).toMatchObject({
      PGHOST: 'db.example.invalid',
      PGPORT: '5432',
      PGDATABASE: 'catalog',
      PGUSER: 'tap-user',
      PGPASSWORD: 'tap-pass',
      PGSSLMODE: 'require',
      PGCHANNELBINDING: 'require',
    });
    expect(command.args.join(' ')).not.toContain(databaseUrl);
    expect(command.args.join(' ')).not.toContain('tap-pass');
    expect(command.env).not.toHaveProperty('DATABASE_URL');
    expect(Object.values(command.env)).not.toContain(databaseUrl);
  });

  it('rejects a missing DATABASE_URL with a clear message that contains no value', () => {
    expect(() => getPgProveCommand(undefined, 'catalog.test.sql')).toThrow('DATABASE_URL is required for pgTAP validation.');
  });

  it('redacts full PostgreSQL URLs from pg_prove output', () => {
    const databaseUrl = ['postgresql:', '/', '/', 'tap-user:tap-pass@db.example.invalid/catalog'].join('');
    expect(redactPgProveOutput(`failed connecting to ${databaseUrl}`, databaseUrl))
      .toBe('failed connecting to [redacted database connection]');
  });
});
