import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validatePublicEnv } from './env';

describe('validatePublicEnv', () => {
  it('statically references Expo public variables for production inlining', () => {
    const implementation = readFileSync(new URL('./env.ts', import.meta.url), 'utf8');
    const variableNames = [
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_STADIA_API_KEY',
    ];

    for (const name of variableNames) {
      expect(implementation).toContain(`process.env.${name}`);
    }
  });

  it('names all required variables when configuration is missing', () => {
    expect(() => validatePublicEnv({})).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => validatePublicEnv({})).toThrow(/EXPO_PUBLIC_STADIA_API_KEY/);
  });

  it('returns the configured public endpoints without database credentials', () => {
    expect(
      validatePublicEnv({
        EXPO_PUBLIC_API_URL: 'https://api.example.test/v1',
        EXPO_PUBLIC_STADIA_API_KEY: 'public-stadia-key',
      }),
    ).toEqual({
      apiUrl: 'https://api.example.test/v1',
      stadiaApiKey: 'public-stadia-key',
    });
  });
});
