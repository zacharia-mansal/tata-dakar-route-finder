import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const apiDirectory = fileURLToPath(new URL('../apps/api', import.meta.url));
const projectDirectory = fileURLToPath(new URL('..', import.meta.url));

describe('API workspace typecheck setup', () => {
  it('inherits the strict base config and uses root tools without adding dependencies', () => {
    const tsconfigPath = `${apiDirectory}/tsconfig.json`;
    const hasTsconfig = existsSync(tsconfigPath);
    expect.soft(hasTsconfig).toBe(true);

    if (hasTsconfig) {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8')) as {
        extends?: string;
        compilerOptions?: Record<string, unknown>;
      };
      expect.soft(tsconfig.extends).toBe('../../tsconfig.base.json');
      expect.soft(tsconfig.compilerOptions?.strict).toBe(true);
      expect.soft(
        Object.entries(tsconfig.compilerOptions ?? {}).some(([key, value]) =>
          /^strict|noImplicit|noUnchecked|exactOptional/.test(key) && value === false,
        ),
      ).toBe(false);
    }

    const packageJson = JSON.parse(
      readFileSync(`${apiDirectory}/package.json`, 'utf8'),
    ) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect.soft(packageJson.scripts?.typecheck).toBe('tsc --noEmit');
    expect.soft(packageJson.scripts?.test).toBe('vitest run');
    expect.soft(packageJson.dependencies).toEqual({ '@neondatabase/serverless': '1.2.0' });
    expect.soft(packageJson.devDependencies).toBeUndefined();

    const baseConfig = JSON.parse(
      readFileSync(`${projectDirectory}/tsconfig.base.json`, 'utf8'),
    ) as { extends?: string; compilerOptions?: Record<string, unknown> };
    const rootPackage = JSON.parse(
      readFileSync(`${projectDirectory}/package.json`, 'utf8'),
    ) as { devDependencies?: Record<string, string> };

    expect.soft(baseConfig.extends).toBeUndefined();
    expect.soft(JSON.stringify(baseConfig)).not.toMatch(/\bexpo(?:\/|\b)/i);
    expect.soft(rootPackage.devDependencies?.expo).toBeUndefined();
  });
});
