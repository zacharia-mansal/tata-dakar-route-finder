export interface PublicEnv {
  apiUrl: string;
  stadiaApiKey: string;
}

export type PublicEnvInput = Partial<
  Record<'EXPO_PUBLIC_API_URL' | 'EXPO_PUBLIC_STADIA_API_KEY', string | undefined>
>;

export function validatePublicEnv(input?: PublicEnvInput): PublicEnv {
  const source = input ?? {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_STADIA_API_KEY: process.env.EXPO_PUBLIC_STADIA_API_KEY,
  };
  const required = {
    EXPO_PUBLIC_API_URL: source.EXPO_PUBLIC_API_URL?.trim(),
    EXPO_PUBLIC_STADIA_API_KEY: source.EXPO_PUBLIC_STADIA_API_KEY?.trim(),
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required public environment variables: ${missing.join(', ')}`);
  }

  const apiUrl = required.EXPO_PUBLIC_API_URL!;
  let parsedApiUrl: URL;

  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid HTTPS URL');
  }

  if (parsedApiUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTPS');
  }

  if (parsedApiUrl.username || parsedApiUrl.password) {
    throw new Error('EXPO_PUBLIC_API_URL must not include credentials');
  }

  if (parsedApiUrl.search || parsedApiUrl.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must not include query parameters or fragments');
  }

  return {
    apiUrl,
    stadiaApiKey: required.EXPO_PUBLIC_STADIA_API_KEY!,
  };
}
