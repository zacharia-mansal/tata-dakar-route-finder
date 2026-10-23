// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider, useLocale } from './locale-provider';

const storedLanguages = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storedLanguages.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storedLanguages.set(key, value);
    },
  },
}));

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'fr-SN' }],
}));

function LocaleProbe() {
  const { locale, setLocale } = useLocale();
  return createElement('button', { onClick: () => setLocale('en') }, locale);
}

describe('LocaleProvider', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  beforeEach(() => storedLanguages.clear());

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('shares the chosen language and saves the preference', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(LocaleProvider, null, createElement(LocaleProbe)),
      );
      await Promise.resolve();
    });
    expect(container.textContent).toBe('fr');

    await act(async () => {
      container?.querySelector('button')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await Promise.resolve();
    });
    expect(container.textContent).toBe('en');
    expect(storedLanguages.get('tata.locale')).toBe('en');
  });

  it('restores a supported saved language ahead of the device language', async () => {
    storedLanguages.set('tata.locale', 'en');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(LocaleProvider, null, createElement(LocaleProbe)),
      );
      await Promise.resolve();
    });

    expect(container.textContent).toBe('en');
  });
});
