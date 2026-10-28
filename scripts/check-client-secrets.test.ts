import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { findClientSecretLeaks, findExpoPublicEnvLeaks } from './check-client-secrets.mjs';
import { validatePublicEnv } from '../apps/client/src/config/env.ts';

const clientFile = 'apps/client/src/config/runtime.ts';
const createTestPostgresUrl = () => ['postgresql:', '/', '/', 'test-user:test-password@db.example.invalid/catalog'].join('');
const createTestCredentialUrl = () => ['https://', ['test-user', 'test-password'].join(':'), '@api.example.invalid/private'].join('');

describe('findClientSecretLeaks', () => {
  it('allows ordinary client configuration and public HTTPS endpoints', () => {
    const source = [
      "export const API_URL = 'https://api.example.com';",
      "export const EXPO_PUBLIC_API_URL = 'https://api.example.com';",
      "export const EXPO_PUBLIC_MAP_STYLE = 'https://tiles.example.com/style.json';",
    ].join('\n');

    expect(findClientSecretLeaks(source, clientFile)).toEqual([]);
  });

  it('flags a DATABASE_URL reference even when its value is not in the file', () => {
    const findings = findClientSecretLeaks(
      'const database = process.env.DATABASE_URL;',
      clientFile,
    );

    expect(findings.map(({ rule }) => rule)).toContain('database-url');
  });

  it('flags password variable references even when the value is supplied elsewhere', () => {
    const findings = findClientSecretLeaks(
      ['const PASS', 'WORD = process.env.RUNTIME_', 'PASSWORD;'].join(''),
      clientFile,
    );

    expect(findings.map(({ rule }) => rule)).toContain('secret-reference');
  });

  it('flags PostgreSQL connection strings', () => {
    const findings = findClientSecretLeaks(
      `const database = '${createTestPostgresUrl()}';`,
      clientFile,
    );

    expect(findings.map(({ rule }) => rule)).toContain('postgres-url');
  });

  it('flags credentials embedded in any URL', () => {
    const findings = findClientSecretLeaks(
      `const endpoint = '${createTestCredentialUrl()}';`,
      clientFile,
    );

    expect(findings.map(({ rule }) => rule)).toContain('url-credentials');
  });

  it('flags secret-bearing EXPO_PUBLIC_ variables', () => {
    const findings = findClientSecretLeaks(
      "export const EXPO_PUBLIC_DB_PASSWORD = 'expo-db-password-value';",
      clientFile,
    );

    expect(findings.map(({ rule }) => rule)).toContain('expo-public-secret');
  });

  it('flags the server-only memory rate-limit setting in client code and Expo public env', () => {
    const clientFindings = findClientSecretLeaks(
      'const enabled = process.env.ALLOW_MEMORY_RATE_LIMIT;',
      clientFile,
    );
    const expoFindings = findExpoPublicEnvLeaks(
      'EXPO_PUBLIC_ALLOW_MEMORY_RATE_LIMIT=1',
      '.env.local',
    );

    expect(clientFindings.map(({ rule }) => rule)).toContain('server-only-env-reference');
    expect(expoFindings.map(({ rule }) => rule)).toContain('server-only-env-reference');
  });

  it('does not include secret values in finding messages or serialized reports', () => {
    const secrets = ['fixture-auth-value', 'fixture-url-value', 'fixture-expo-value'];
    const databaseVariable = ['DATABASE', '_URL'].join('');
    const publicPasswordVariable = ['EXPO_PUBLIC_DB_', 'PASSWORD'].join('');
    const source = [
      `const ${databaseVariable} = '${createTestPostgresUrl()}';`,
      `const endpoint = '${createTestCredentialUrl()}';`,
      `const ${publicPasswordVariable} = '${secrets[2]}';`,
    ].join('\n');
    const findings = findClientSecretLeaks(source, clientFile);
    const report = JSON.stringify(findings);

    expect(findings.length).toBeGreaterThan(0);
    for (const secret of secrets) {
      expect(report).not.toContain(secret);
      for (const { message } of findings) {
        expect(message).not.toContain(secret);
      }
    }
  });
});

describe('findExpoPublicEnvLeaks', () => {
  it('allows an HTTPS endpoint and a public map key in Expo environment files', () => {
    const source = [
      'EXPO_PUBLIC_API_URL=https://api.example.test/v1',
      'EXPO_PUBLIC_STADIA_API_KEY=public-map-key',
    ].join('\n');

    expect(findExpoPublicEnvLeaks(source, '.env.example')).toEqual([]);
  });

  it('rejects server-only key names exposed through Expo public env', () => {
    const findings = findExpoPublicEnvLeaks('EXPO_PUBLIC_DB_KEY=', '.env.local');

    expect(findings.map(({ rule }) => rule)).toContain('expo-public-secret');
  });

  it('rejects PostgreSQL connection strings exposed through Expo public env', () => {
    const findings = findExpoPublicEnvLeaks(
      `EXPO_PUBLIC_API_URL=${createTestPostgresUrl()}`,
      '.env.local',
    );

    expect(findings.map(({ rule }) => rule)).toContain('postgres-url');
  });

  it('rejects query strings and fragments in the public API endpoint', () => {
    const findings = findExpoPublicEnvLeaks(
      'EXPO_PUBLIC_API_URL=https://api.example.test/v1?version=1',
      '.env.local',
    );

    expect(findings.map(({ rule }) => rule)).toContain('public-url-query');
  });

  it('confirms the client environment implementation contains no server credential findings', () => {
    const implementation = readFileSync(
      new URL('../apps/client/src/config/env.ts', import.meta.url),
      'utf8',
    );

    expect(findClientSecretLeaks(implementation, 'apps/client/src/config/env.ts')).toEqual([]);
  });

  it('keeps HTTP and query strings out of the public API endpoint at runtime', () => {
    expect(() =>
      validatePublicEnv({
        EXPO_PUBLIC_API_URL: 'http://api.example.test/v1',
        EXPO_PUBLIC_STADIA_API_KEY: 'public-map-key',
      }),
    ).toThrow(/HTTPS/);

    expect(() =>
      validatePublicEnv({
        EXPO_PUBLIC_API_URL: 'https://api.example.test/v1?version=1',
        EXPO_PUBLIC_STADIA_API_KEY: 'public-map-key',
      }),
    ).toThrow(/query|fragment/i);
  });
});
