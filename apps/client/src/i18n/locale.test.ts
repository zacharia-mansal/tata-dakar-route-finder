import { describe, expect, it } from 'vitest';
import { getLocale } from './locale';
import { messages } from './messages';

describe('getLocale', () => {
  it('defaults to French for a French device locale', () => {
    expect(getLocale(undefined, 'fr-SN')).toBe('fr');
  });

  it('uses the saved English preference over the device locale', () => {
    expect(getLocale('en', 'fr-SN')).toBe('en');
  });

  it('falls back to French when neither saved nor device language is supported', () => {
    expect(getLocale('es', 'es-ES')).toBe('fr');
  });

  it('uses a supported device language when there is no supported saved preference', () => {
    expect(getLocale('es', 'en-US')).toBe('en');
  });
});

describe('messages', () => {
  it('provides search and permission copy in both supported languages', () => {
    expect(messages.fr.searchButton).toBe('Rechercher un trajet');
    expect(messages.en.searchButton).toBe('Find a route');
    expect(messages.fr.locationPermissionTitle).toBeTruthy();
    expect(messages.en.locationPermissionTitle).toBeTruthy();
    expect(messages.fr.networkRequiredMessage).toBeTruthy();
    expect(messages.en.networkRequiredMessage).toBeTruthy();
  });
});
