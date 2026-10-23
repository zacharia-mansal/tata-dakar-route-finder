export type Locale = 'fr' | 'en';

function supportedLocale(value: string | null | undefined): Locale | undefined {
  const language = value?.trim().toLowerCase().split(/[-_]/, 1)[0];

  if (language === 'fr' || language === 'en') {
    return language;
  }

  return undefined;
}

export function getLocale(
  savedLocale: string | null | undefined,
  deviceLocale: string | null | undefined,
): Locale {
  return supportedLocale(savedLocale) ?? supportedLocale(deviceLocale) ?? 'fr';
}
