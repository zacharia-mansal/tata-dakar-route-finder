import { describe, expect, it, vi } from 'vitest';
import { createPlaceResolver, createStadiaGeocoder } from './places';
import type { PlaceCandidate } from '../../../packages/domain/src/place';

const candidate = (id: string, displayName: string, matchedAlias?: string): PlaceCandidate => ({
  id,
  displayName,
  areaName: 'SICAP',
  coordinates: { lat: 14.71, lon: -17.45 },
  ...(matchedAlias ? { matchedAlias } : {}),
  source: 'catalogue',
});

describe('place resolution', () => {
  it('returns all verified alias matches so the client can ask the user to disambiguate', async () => {
    const geocoder = { search: vi.fn() };
    const catalogue = {
      search: vi.fn().mockResolvedValue([
        candidate('place-1', 'ISM', 'Institut Supérieur de Management'),
        candidate('place-2', 'Université', 'Institut Supérieur de Management'),
      ]),
    };
    const resolvePlaces = createPlaceResolver({ catalogue, geocoder });

    const result = await resolvePlaces('Institut Supérieur de Management', 'fr');

    expect(result.kind).toBe('ambiguous');
    expect(result.places.map(({ id }) => id)).toEqual(['place-1', 'place-2']);
    expect(geocoder.search).not.toHaveBeenCalled();
  });

  it('uses the injected geocoder only when the published catalogue has no match', async () => {
    const geocoder = {
      search: vi.fn().mockResolvedValue([{
        id: 'geocoded-1',
        displayName: 'Marché local',
        areaName: 'SICAP',
        coordinates: { lat: 14.71, lon: -17.45 },
        source: 'geocoder',
      }]),
    };
    const catalogue = { search: vi.fn().mockResolvedValue([]) };
    const resolvePlaces = createPlaceResolver({ catalogue, geocoder });

    const result = await resolvePlaces('Marché local', 'fr');

    expect(catalogue.search).toHaveBeenCalledWith('Marché local', 'fr');
    expect(geocoder.search).toHaveBeenCalledWith('Marché local', 'fr');
    expect(result).toMatchObject({ kind: 'matches', places: [{ id: 'geocoded-1', source: 'geocoder' }] });
  });

  it('does not geocode a non-empty catalogue result and preserves the alias separately from the display label', async () => {
    const geocoder = { search: vi.fn() };
    const catalogue = { search: vi.fn().mockResolvedValue([candidate('ism', 'Institut Supérieur de Management', 'ISM')]) };
    const resolvePlaces = createPlaceResolver({ catalogue, geocoder });

    const result = await resolvePlaces('ISM', 'fr');

    expect(result).toMatchObject({
      kind: 'matches',
      places: [{ displayName: 'Institut Supérieur de Management', matchedAlias: 'ISM' }],
    });
    expect(geocoder.search).not.toHaveBeenCalled();
  });

  it('rejects a blank query without calling a provider', async () => {
    const catalogue = { search: vi.fn() };
    const geocoder = { search: vi.fn() };
    const resolvePlaces = createPlaceResolver({ catalogue, geocoder });

    await expect(resolvePlaces('   ', 'fr')).rejects.toThrow(/query/i);
    expect(catalogue.search).not.toHaveBeenCalled();
    expect(geocoder.search).not.toHaveBeenCalled();
  });

  it('uses the injected fetch mock for Stadia and never calls the global network fetch', async () => {
    const globalFetch = vi.fn(() => { throw new Error('Unexpected network call from test'); });
    const injectedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', globalFetch);

    try {
      const geocoder = createStadiaGeocoder({ apiKey: 'fixture-api-key', fetch: injectedFetch });

      await geocoder.search('Marché local', 'fr');

      expect(injectedFetch).toHaveBeenCalledTimes(1);
      expect(globalFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
