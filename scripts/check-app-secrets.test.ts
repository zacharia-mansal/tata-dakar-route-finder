import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll } from 'vitest';

let findAppSecretLeaks: (source: string, filename: string) => { rule: string; file: string; message: string }[];
let findClientSecretLeaks: (source: string, filename: string) => { rule: string; file: string; message: string }[];

beforeAll(async () => {
  const scannerModule = './check-app-secrets.mjs';
  const scanner = await import(scannerModule) as {
    findAppSecretLeaks(source: string, filename: string): { rule: string; file: string; message: string }[];
    findClientSecretLeaks(source: string, filename: string): { rule: string; file: string; message: string }[];
  };
  findAppSecretLeaks = scanner.findAppSecretLeaks;
  findClientSecretLeaks = scanner.findClientSecretLeaks;
});

const appFile = 'apps/app/lib/config.dart';

describe('app secret scan for the future Flutter client', () => {
  it.each([
    ['DATABASE_URL', 'DATABASE_URL=fixture'],
    ['DATABASE_URL_PUBLIC_API', 'DATABASE_URL_PUBLIC_API=fixture'],
    ['STADIA_ROUTING_API_KEY', 'STADIA_ROUTING_API_KEY=fixture'],
    ['postgres connection URL', 'postgres://fixture.invalid/database'],
    ['Neon API key name', 'NEON_API_KEY=fixture'],
  ])('rejects %s in app source', (_label, source) => {
    expect(findAppSecretLeaks(source, appFile)).not.toEqual([]);
  });

  it.each(['.dart', '.yaml', '.json', '.env', '.gradle', '.plist'])(
    'scans server credential references in %s files', (extension) => {
      const filename = `apps/app/config/settings${extension}`;
      expect(findClientSecretLeaks('NEON_API_KEY=fixture', filename)).not.toEqual([]);
    },
  );

  it('rejects secrets passed by --dart-define in Dart source', () => {
    const source = "const secret = String.fromEnvironment('DATABASE_URL');";
    expect(findAppSecretLeaks(source, appFile)).not.toEqual([]);
  });

  it('allows a clean app source file', () => {
    expect(findAppSecretLeaks('const apiBaseUrl = String.fromEnvironment("API_BASE_URL");', appFile)).toEqual([]);
  });

  it('allows the repository scan to pass when apps/app does not exist yet', () => {
    const result = spawnSync(process.execPath, ['scripts/check-app-secrets.mjs'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/0 app file/);
  });
});
