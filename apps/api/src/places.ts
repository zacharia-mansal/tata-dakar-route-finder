import type { Coordinates } from '../../../packages/domain/src/map';
import type { PlaceCandidate } from '../../../packages/domain/src/place';

export interface PlaceCatalogue {
  search(query: string, locale: string, signal?: AbortSignal): Promise<PlaceCandidate[]>;
}

export interface PlaceGeocoder {
  search(query: string, locale: string, signal?: AbortSignal): Promise<PlaceCandidate[]>;
}

export type PlaceResolution =
  | { kind: 'matches'; places: PlaceCandidate[] }
  | { kind: 'ambiguous'; places: PlaceCandidate[] };

export function createPlaceResolver(dependencies: {
  catalogue: PlaceCatalogue;
  geocoder: PlaceGeocoder;
}) {
  return async (rawQuery: string, locale: string, signal?: AbortSignal): Promise<PlaceResolution> => {
    const query = rawQuery.trim();
    if (!query) throw new TypeError('A non-empty place query is required');
    const catalogueMatches = signal
      ? await dependencies.catalogue.search(query, locale, signal)
      : await dependencies.catalogue.search(query, locale);
    if (catalogueMatches.length > 0) {
      return {
        kind: catalogueMatches.length > 1 ? 'ambiguous' : 'matches',
        places: catalogueMatches,
      };
    }
    const geocoded = signal
      ? await dependencies.geocoder.search(query, locale, signal)
      : await dependencies.geocoder.search(query, locale);
    return { kind: geocoded.length > 1 ? 'ambiguous' : 'matches', places: geocoded };
  };
}

interface StadiaFeature {
  geometry?: { coordinates?: unknown };
  properties?: {
    gid?: unknown;
    name?: unknown;
    label?: unknown;
    locality?: unknown;
    county?: unknown;
    region?: unknown;
  };
}

function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCoordinates(value: unknown): Coordinates | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const [lon, lat] = value;
  if (typeof lat !== 'number' || typeof lon !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return undefined;
  }
  return { lat, lon };
}

export function createStadiaGeocoder(options: {
  apiKey: string;
  fetch: typeof fetch;
}) {
  return {
    async search(query: string, _locale: string, signal?: AbortSignal): Promise<PlaceCandidate[]> {
      const url = new URL('https://api.stadiamaps.com/geocoding/v1/search');
      url.searchParams.set('text', query);
      const response = await options.fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Stadia-Auth ${options.apiKey}`,
        },
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw new Error('Stadia geocoder request failed');
      const payload: unknown = await response.json();
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('features' in payload) ||
        !Array.isArray(payload.features)
      ) {
        return [];
      }
      return (payload.features as StadiaFeature[]).flatMap((feature) => {
        const properties = feature.properties;
        const coordinates = parseCoordinates(feature.geometry?.coordinates);
        const id = textOrEmpty(properties?.gid);
        const displayName = textOrEmpty(properties?.name) || textOrEmpty(properties?.label);
        if (!coordinates || !id || !displayName) return [];
        const areaName =
          textOrEmpty(properties?.locality) ||
          textOrEmpty(properties?.county) ||
          textOrEmpty(properties?.region) ||
          displayName;
        return [{ id, displayName, areaName, coordinates, source: 'geocoder' as const }];
      });
    },
  };
}
