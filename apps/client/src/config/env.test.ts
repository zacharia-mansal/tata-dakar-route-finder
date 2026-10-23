import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validatePublicEnv } from './env';

describe('validatePublicEnv', () => {
  it('statically references Expo public variables for production inlining', () => {
    const implementation = readFileSync(new URL('./env.ts', import.meta.url), 'utf8');
    const variableNames = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_STADIA_API_KEY',
    ];

    for (const name of variableNames) {
      expect(implementation).toContain(`process.env.${name}`);
    }
  });

  it('names all required variables when configuration is missing', () => {
    expect(() => validatePublicEnv({})).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
    expect(() => validatePublicEnv({})).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
    expect(() => validatePublicEnv({})).toThrow(/EXPO_PUBLIC_STADIA_API_KEY/);
  });

  it('returns the configured public service credentials', () => {
    expect(
      validatePublicEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
        EXPO_PUBLIC_STADIA_API_KEY: 'public-stadia-key',
      }),
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'public-anon-key',
      stadiaApiKey: 'public-stadia-key',
    });
  });
});
