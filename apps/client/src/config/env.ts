export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  stadiaApiKey: string;
}

export type PublicEnvInput = Partial<
  Record<
    | 'EXPO_PUBLIC_SUPABASE_URL'
    | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
    | 'EXPO_PUBLIC_STADIA_API_KEY',
    string | undefined
  >
>;

export function validatePublicEnv(
  input?: PublicEnvInput,
): PublicEnv {
  const source = input ?? {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_STADIA_API_KEY: process.env.EXPO_PUBLIC_STADIA_API_KEY,
  };
  const required = {
    EXPO_PUBLIC_SUPABASE_URL: source.EXPO_PUBLIC_SUPABASE_URL?.trim(),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: source.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    EXPO_PUBLIC_STADIA_API_KEY: source.EXPO_PUBLIC_STADIA_API_KEY?.trim(),
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required public environment variables: ${missing.join(', ')}`);
  }

  return {
    supabaseUrl: required.EXPO_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: required.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    stadiaApiKey: required.EXPO_PUBLIC_STADIA_API_KEY!,
  };
}
