import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import type { PublishedTransitNetworkSnapshot } from './neon';
import type { SharedRateLimitStore } from './rateLimit';
import { createResolvePlacesEndpoint } from '../api/resolve-places';
import { createSearchRoutesEndpoint } from '../api/search-routes';
import { createSearchRoutesHandler } from './search-routes';

type SearchDependencies = Omit<Parameters<typeof createSearchRoutesHandler>[0], 'rateLimit'>;
type RecordValue = Record<string, unknown>;

const require = createRequire(import.meta.url);
const { load } = require('js-yaml') as { load(source: string): unknown };
const openapi = load(readFileSync(new URL('../../../docs/api/openapi.yaml', import.meta.url), 'utf8')) as RecordValue;

const place: PlaceCandidate = {
  id: 'fixture-place',
  displayName: 'Fixture place',
  areaName: 'Fixture area',
  coordinates: { lat: 14.69, lon: -17.44 },
  source: 'catalogue',
};

const snapshot: PublishedTransitNetworkSnapshot = {
  directions: [{ id: 'fixture-direction', network: 'aftu_dakar', networkName: 'AFTU Dakar', qualityStatus: 'confirmed', source: 'test_fixture', lineNumber: '24', directionName: 'Fixture direction', displayedDestinationLabel: 'Fixture', receiverQuestion: 'Fixture', stops: [{ id: 'fixture-stop', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Fixture stop', coordinates: { lat: 14.69, lon: -17.44 }, aliases: [] }] }],
  stops: [{ id: 'fixture-stop', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Fixture stop', coordinates: { lat: 14.69, lon: -17.44 }, aliases: [] }],
  servedPlaces: [{
    ...place,
    placeId: place.id,
    aliases: [],
    directionId: 'fixture-direction',
    alightingStopId: 'fixture-stop',
    verifiedAt: '2026-10-29T12:00:00.000Z',
  }],
};

function storeReturning(count: (key: string) => number): SharedRateLimitStore {
  return { increment: vi.fn(async (key: string) => count(key)) };
}

function freshStore(): SharedRateLimitStore {
  const counts = new Map<string, number>();
  return storeReturning((key) => {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  });
}

function request(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function resolveHandler(locale: 'fr' | 'en', store = freshStore()) {
  return createResolvePlacesEndpoint({
    env: { VERCEL_ENV: 'development', ALLOW_MEMORY_RATE_LIMIT: '1' },
    sharedRateLimitStore: store,
    stadiaApiKey: '',
    resolvePlaces: async () => ({ kind: 'matches', places: [place] }),
  });
}

function searchDependencies(searchRoutes: SearchDependencies['searchRoutes']): SearchDependencies {
  return {
    resolvePlaces: async () => ({ kind: 'matches', places: [] }),
    loadPublishedSnapshot: async () => snapshot,
    searchRoutes,
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  };
}

function searchHandler(store?: SharedRateLimitStore, searchRoutes: SearchDependencies['searchRoutes'] = async () => []) {
  return createSearchRoutesEndpoint({
    env: store ? { VERCEL_ENV: 'preview' } : { VERCEL_ENV: 'preview' },
    sharedRateLimitStore: store,
    dependencies: searchDependencies(searchRoutes),
  });
}

const expectedResolveUnavailable = {
  fr: { error: 'service_unavailable', message: 'La recherche de lieux est temporairement indisponible.' },
  en: { error: 'service_unavailable', message: 'Place search is temporarily unavailable.' },
} as const;

const expectedRouteUnavailable = {
  fr: { error: 'service_unavailable', message: 'La recherche d’itinéraire est temporairement indisponible.' },
  en: { error: 'service_unavailable', message: 'Route search is temporarily unavailable.' },
} as const;

const expectedWalkingUnavailable = {
  fr: {
    error: 'service_unavailable',
    message: 'La recherche de trajet est temporairement indisponible.',
    partial: true,
    partialReason: 'walking_service_error',
  },
  en: {
    error: 'service_unavailable',
    message: 'Route search is temporarily unavailable.',
    partial: true,
    partialReason: 'walking_service_error',
  },
} as const;

describe('OpenAPI localized 503 and Retry-After contract', () => {
  it.each(['fr', 'en'] as const)('tests and documents resolve-places 503 in %s', async (locale) => {
    const handler = resolveHandler(locale);
    const response = await handler(request('/api/resolve-places', { query: 'place', locale }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expectedResolveUnavailable[locale]);
    expect(response.headers.has('retry-after')).toBe(false);
  });

  it.each(['fr', 'en'] as const)('tests and documents search-routes rate-limit 503 in %s', async (locale) => {
    const handler = searchHandler();
    const response = await handler(request('/api/search-routes', {
      origin: { kind: 'coordinates', coordinates: place.coordinates },
      destination: { source: 'catalogue', id: place.id },
      locale,
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expectedRouteUnavailable[locale]);
    expect(response.headers.has('retry-after')).toBe(false);
  });

  it.each(['fr', 'en'] as const)('tests the no-complete-journey walking-service failure in %s', async (locale) => {
    const handler = searchHandler(freshStore(), async () => ({
      routes: [],
      partial: true,
      partialReason: 'walking_service_error',
    }));
    const response = await handler(request('/api/search-routes', {
      origin: { kind: 'coordinates', coordinates: place.coordinates },
      destination: { source: 'catalogue', id: place.id },
      locale,
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expectedWalkingUnavailable[locale]);
    expect(response.headers.has('retry-after')).toBe(false);
  });

  it.each([
    ['resolve-places', '/api/resolve-places', (locale: 'fr' | 'en') => ({ query: 'place', locale })],
    ['search-routes', '/api/search-routes', (locale: 'fr' | 'en') => ({
      origin: { kind: 'coordinates', coordinates: place.coordinates },
      destination: { source: 'catalogue', id: place.id },
      locale,
    })],
  ] as const)('returns Retry-After on a 429 from %s', async (endpoint, path, bodyFor) => {
    let count = 0;
    const store = storeReturning(() => ++count);
    const handler = endpoint === 'resolve-places'
      ? createResolvePlacesEndpoint({
          env: { VERCEL_ENV: 'preview', RATE_LIMIT_RESOLVE_PLACES_PER_MINUTE: '1' },
          sharedRateLimitStore: store,
          stadiaApiKey: 'fixture-only-key',
          resolvePlaces: async () => ({ kind: 'matches', places: [place] }),
        })
      : createSearchRoutesEndpoint({
          env: { VERCEL_ENV: 'preview', RATE_LIMIT_SEARCH_ROUTES_PER_MINUTE: '1' },
          sharedRateLimitStore: store,
          dependencies: searchDependencies(async () => []),
        });

    await handler(request(path, bodyFor('en'), { 'x-vercel-forwarded-for': 'fixture-client' }));
    const response = await handler(request(path, bodyFor('en'), { 'x-vercel-forwarded-for': 'fixture-client' }));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('documents localized 503 bodies and Retry-After only on 429', () => {
    const paths = openapi.paths as RecordValue;
    const components = openapi.components as RecordValue;
    const schemas = components.schemas as RecordValue;
    const responses = components.responses as RecordValue;
    const resolve503 = (((paths['/api/resolve-places'] as RecordValue).post as RecordValue).responses as RecordValue)['503'];
    const route503 = (((paths['/api/search-routes'] as RecordValue).post as RecordValue).responses as RecordValue)['503'] as RecordValue;
    const serviceUnavailable = responses.ServiceUnavailable as RecordValue;
    const rateLimited = responses.RateLimited as RecordValue;

    expect(resolve503).toBeTruthy();
    expect(schemas.ServiceUnavailableError).toBeTruthy();
    expect(schemas.PartialSearchError).toBeTruthy();
    expect(route503).toBeTruthy();
    expect(serviceUnavailable.content).toHaveProperty('application/json.examples.placeUnavailableFr');
    expect(serviceUnavailable.content).toHaveProperty('application/json.examples.placeUnavailableEn');
    expect(route503.content).toHaveProperty('application/json.examples.routeUnavailableFr');
    expect(route503.content).toHaveProperty('application/json.examples.routeUnavailableEn');
    expect(route503.content).toHaveProperty('application/json.examples.walkingServiceErrorFr');
    expect(route503.content).toHaveProperty('application/json.examples.walkingServiceErrorEn');
    expect(rateLimited.headers).toHaveProperty('Retry-After');
    expect(route503).not.toHaveProperty('headers.Retry-After');
    expect(responses.ServiceUnavailable).not.toHaveProperty('headers.Retry-After');
  });
});
