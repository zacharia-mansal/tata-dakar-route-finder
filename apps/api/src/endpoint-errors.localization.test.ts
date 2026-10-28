import { describe, expect, it, vi } from 'vitest';
import type { JourneyOption } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import type { PublishedTransitNetworkSnapshot } from './neon';
import type { SharedRateLimitStore } from './rateLimit';
import { createSearchRoutesHandler } from './search-routes';
import { createResolvePlacesEndpoint } from '../api/resolve-places';
import { createSearchRoutesEndpoint } from '../api/search-routes';

type SearchDependencies = Omit<Parameters<typeof createSearchRoutesHandler>[0], 'rateLimit'>;

const place: PlaceCandidate = {
  id: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates: { lat: 14.696, lon: -17.463 },
  source: 'catalogue',
};

const snapshot: PublishedTransitNetworkSnapshot = {
  directions: [],
  stops: [],
  servedPlaces: [{
    ...place,
    placeId: place.id,
    aliases: ['ISM'],
    directionId: 'direction-24-out',
    alightingStopId: 'university',
    verifiedAt: '2026-10-22T12:00:00.000Z',
  }],
};

function createStore(): SharedRateLimitStore {
  const counts = new Map<string, number>();
  return {
    increment: async (key) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
  };
}

function createSearchDependencies(): SearchDependencies {
  return {
    loadPublishedSnapshot: vi.fn(async () => snapshot),
    resolvePlaces: vi.fn(async () => ({ kind: 'matches', places: [] })),
    searchRoutes: vi.fn(async (): Promise<JourneyOption[]> => []),
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  };
}

function resolveHandler(env: Record<string, string | undefined> = { VERCEL_ENV: 'preview', RATE_LIMIT_RESOLVE_PLACES_PER_MINUTE: '1' }) {
  const resolver = vi.fn(async () => ({ kind: 'matches', places: [place] }));
  const handler = createResolvePlacesEndpoint({
    env,
    sharedRateLimitStore: createStore(),
    stadiaApiKey: 'fixture-only-key',
    resolvePlaces: resolver,
  });
  return { handler, resolver };
}

function searchHandler(env: Record<string, string | undefined> = { VERCEL_ENV: 'preview', RATE_LIMIT_SEARCH_ROUTES_PER_MINUTE: '1' }) {
  const dependencies = createSearchDependencies();
  const handler = createSearchRoutesEndpoint({ env, sharedRateLimitStore: createStore(), dependencies });
  return { handler, dependencies };
}

function makeRequest(
  url: string,
  body: string,
  headers: Record<string, string> = {},
  method = 'POST',
): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: method === 'GET' ? undefined : body,
  });
}

const resolveUrl = 'https://api.example.test/api/resolve-places';
const searchUrl = 'https://api.example.test/api/search-routes';
const searchPayload = JSON.stringify({
  origin: { kind: 'coordinates', coordinates: { lat: 14.707, lon: -17.451 } },
  destination: place,
  locale: 'fr',
});

describe('localized safe API error responses', () => {
  it.each([
    ['resolve-places', 'fr', 'Méthode non autorisée.'],
    ['resolve-places', 'en', 'Method not allowed.'],
    ['search-routes', 'fr', 'Méthode non autorisée.'],
    ['search-routes', 'en', 'Method not allowed.'],
  ] as const)('localizes 405 for %s from Accept-Language %s', async (endpoint, acceptLanguage, message) => {
    const handler = endpoint === 'resolve-places' ? resolveHandler().handler : searchHandler().handler;
    const url = endpoint === 'resolve-places' ? resolveUrl : searchUrl;
    const response = await handler(makeRequest(url, '', { 'accept-language': acceptLanguage }, 'GET'));
    const body = await response.json() as { error?: string; message?: string };

    expect(response.status).toBe(405);
    expect(body).toEqual({ error: 'method_not_allowed', message });
  });

  it.each([
    ['resolve-places', 'en', 'Invalid request.'],
    ['resolve-places', undefined, 'Requête JSON invalide.'],
    ['search-routes', 'en', 'Invalid request.'],
    ['search-routes', undefined, 'Requête JSON invalide.'],
  ] as const)('localizes malformed JSON for %s with Accept-Language %s', async (endpoint, acceptLanguage, message) => {
    const handler = endpoint === 'resolve-places' ? resolveHandler().handler : searchHandler().handler;
    const url = endpoint === 'resolve-places' ? resolveUrl : searchUrl;
    const requestHeaders: Record<string, string> = acceptLanguage === undefined
      ? {}
      : { 'accept-language': acceptLanguage };
    const marker = 'fixture-input-marker-only';
    const response = await handler(makeRequest(url, `{"query":"${marker}",invalid`, requestHeaders));
    const responseText = await response.text();

    expect(response.status).toBe(400);
    expect(responseText).toContain(message);
    expect(responseText).not.toContain(marker);
  });

  it.each([
    ['resolve-places', 'fr', 'La requête est trop volumineuse.'],
    ['resolve-places', 'en', 'Request body is too large.'],
    ['search-routes', 'fr', 'La requête est trop volumineuse.'],
    ['search-routes', 'en', 'Request body is too large.'],
  ] as const)('localizes 413 for %s from Accept-Language %s without echoing the body', async (endpoint, acceptLanguage, message) => {
    const handler = endpoint === 'resolve-places' ? resolveHandler().handler : searchHandler().handler;
    const url = endpoint === 'resolve-places' ? resolveUrl : searchUrl;
    const marker = 'fixture-input-marker-only';
    const body = JSON.stringify({ query: 'ISM', locale: 'fr', padding: marker + 'x'.repeat(17 * 1024) });
    const length = new TextEncoder().encode(body).length;
    const response = await handler(makeRequest(url, body, {
      'accept-language': acceptLanguage,
      'content-length': String(length),
    }));
    const responseText = await response.text();

    expect(response.status).toBe(413);
    expect(responseText).toContain(message);
    expect(responseText).not.toContain(marker);
  });

  it.each([
    ['resolve-places', 'fr', 'Trop de requêtes. Veuillez réessayer plus tard.'],
    ['resolve-places', 'en', 'Too many requests. Please try again later.'],
    ['search-routes', 'fr', 'Trop de requêtes. Veuillez réessayer plus tard.'],
    ['search-routes', 'en', 'Too many requests. Please try again later.'],
  ] as const)('localizes 429 for %s from the JSON locale and includes Retry-After', async (endpoint, locale, message) => {
    const handler = endpoint === 'resolve-places' ? resolveHandler().handler : searchHandler().handler;
    const url = endpoint === 'resolve-places' ? resolveUrl : searchUrl;
    const body = endpoint === 'resolve-places'
      ? JSON.stringify({ query: 'ISM', locale })
      : JSON.stringify({
          origin: { kind: 'coordinates', coordinates: { lat: 14.707, lon: -17.451 } },
          destination: place,
          locale,
        });
    const firstResponse = await handler(makeRequest(url, body, { 'x-forwarded-for': '198.51.100.24' }));
    const response = await handler(makeRequest(url, body, { 'x-forwarded-for': '198.51.100.24' }));
    const responseText = await response.text();

    expect(firstResponse.status).toBe(200);
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(responseText).toContain(message);
  });
});
