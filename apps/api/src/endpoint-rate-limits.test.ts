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
  directions: [{ id: 'direction-24-out', network: 'aftu_dakar', networkName: 'AFTU Dakar', qualityStatus: 'confirmed', source: 'test_fixture', lineNumber: '24', directionName: 'Fixture direction', displayedDestinationLabel: 'Fixture', receiverQuestion: 'Fixture', stops: [{ id: 'university', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Fixture stop', coordinates: { lat: 14.69, lon: -17.44 }, aliases: [] }] }],
  stops: [{ id: 'university', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Fixture stop', coordinates: { lat: 14.69, lon: -17.44 }, aliases: [] }],
  servedPlaces: [{
    ...place,
    placeId: place.id,
    aliases: ['ISM'],
    directionId: 'direction-24-out',
    alightingStopId: 'university',
    verifiedAt: '2026-10-22T12:00:00.000Z',
  }],
};

function makeStore(): { store: SharedRateLimitStore; increment: ReturnType<typeof vi.fn> } {
  const counts = new Map<string, number>();
  const increment = vi.fn(async (key: string) => {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  });
  return { store: { increment }, increment };
}

function makeSearchDependencies(): SearchDependencies {
  return {
    loadPublishedSnapshot: vi.fn(async () => snapshot),
    resolvePlaces: vi.fn(async () => ({ kind: 'matches', places: [] })),
    searchRoutes: vi.fn(async (): Promise<JourneyOption[]> => []),
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  };
}

function request(url: string, body: unknown, ip = '198.51.100.24', extraHeaders: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'x-vercel-forwarded-for': ip,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

function resolveEndpoint(env: Record<string, string | undefined>, store: SharedRateLimitStore) {
  const resolver = vi.fn(async () => ({ kind: 'matches', places: [place] }));
  const handler = createResolvePlacesEndpoint({
    env,
    sharedRateLimitStore: store,
    stadiaApiKey: 'fixture-only-key',
    resolvePlaces: resolver,
  });
  return { handler, resolver };
}

function searchEndpoint(env: Record<string, string | undefined>, store: SharedRateLimitStore) {
  const dependencies = makeSearchDependencies();
  const handler = createSearchRoutesEndpoint({ env, sharedRateLimitStore: store, dependencies });
  return { handler, dependencies };
}

const resolveBody = { query: 'ISM', locale: 'fr' };
const searchBody = {
  origin: { kind: 'coordinates', coordinates: { lat: 14.707, lon: -17.451 } },
  destination: place,
  locale: 'fr',
};

describe('per-endpoint rate limit quotas', () => {
  it('allows the default 60 resolve-places requests, then returns 429 with Retry-After', async () => {
    const store = makeStore().store;
    const resolve = resolveEndpoint({ VERCEL_ENV: 'preview' }, store).handler;
    const resolveStatuses: number[] = [];
    let lastResolve: Response | undefined;

    for (let index = 0; index < 61; index += 1) {
      lastResolve = await resolve(request('https://api.example.test/api/resolve-places', resolveBody));
      resolveStatuses.push(lastResolve.status);
    }

    expect(resolveStatuses.slice(0, 60).every((status) => status === 200)).toBe(true);
    expect(resolveStatuses[60]).toBe(429);
    expect(Number(lastResolve?.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('allows the default 20 search-routes requests, then returns 429 with Retry-After', async () => {
    const store = makeStore().store;
    const search = searchEndpoint({ VERCEL_ENV: 'preview' }, store).handler;
    const searchStatuses: number[] = [];
    let lastSearch: Response | undefined;

    for (let index = 0; index < 21; index += 1) {
      lastSearch = await search(request('https://api.example.test/api/search-routes', searchBody));
      searchStatuses.push(lastSearch.status);
    }

    expect(searchStatuses.slice(0, 20).every((status) => status === 200)).toBe(true);
    expect(searchStatuses[20]).toBe(429);
    expect(Number(lastSearch?.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it.each([
    ['resolve-places', 'RATE_LIMIT_RESOLVE_PLACES_PER_MINUTE', 2],
    ['search-routes', 'RATE_LIMIT_SEARCH_ROUTES_PER_MINUTE', 3],
  ] as const)('honors the %s environment override', async (endpointName, setting, limit) => {
    const store = makeStore().store;
    const env = { VERCEL_ENV: 'preview', [setting]: String(limit) };
    const handler = endpointName === 'resolve-places'
      ? resolveEndpoint(env, store).handler
      : searchEndpoint(env, store).handler;
    const url = `https://api.example.test/api/${endpointName}`;
    const body = endpointName === 'resolve-places' ? resolveBody : searchBody;
    const statuses: number[] = [];

    for (let index = 0; index <= limit; index += 1) {
      statuses.push((await handler(request(url, body))).status);
    }

    expect(statuses.slice(0, limit).every((status) => status === 200)).toBe(true);
    expect(statuses[limit]).toBe(429);
  });

  it.each([
    ['resolve-places', 'RATE_LIMIT_RESOLVE_PLACES_PER_MINUTE'],
    ['search-routes', 'RATE_LIMIT_SEARCH_ROUTES_PER_MINUTE'],
  ] as const)('fails closed on invalid %s quota before calling external dependencies', async (endpointName, setting) => {
    const store = makeStore();
    const env = { VERCEL_ENV: 'preview', [setting]: 'not-a-positive-integer' };
    const resolveFixture = endpointName === 'resolve-places'
      ? resolveEndpoint(env, store.store)
      : undefined;
    const searchFixture = endpointName === 'search-routes'
      ? searchEndpoint(env, store.store)
      : undefined;
    const handler = resolveFixture?.handler ?? searchFixture!.handler;
    const url = `https://api.example.test/api/${endpointName}`;
    const body = endpointName === 'resolve-places' ? resolveBody : searchBody;
    const response = await handler(request(url, body));

    expect(response.status).toBe(503);
    expect(store.increment).not.toHaveBeenCalled();
    if (resolveFixture !== undefined) {
      expect(resolveFixture.resolver).not.toHaveBeenCalled();
    } else if (searchFixture !== undefined) {
      expect(searchFixture.dependencies.loadPublishedSnapshot).not.toHaveBeenCalled();
    } else {
      throw new Error('Expected one endpoint fixture for the selected endpoint.');
    }
  });

  it('keeps shared budgets distinct by client IP', async () => {
    const store = makeStore().store;
    const env = { VERCEL_ENV: 'preview', RATE_LIMIT_RESOLVE_PLACES_PER_MINUTE: '1' };
    const resolve = resolveEndpoint(env, store).handler;

    const firstClientFirst = await resolve(request('https://api.example.test/api/resolve-places', resolveBody, '198.51.100.1'));
    const firstClientSecond = await resolve(request('https://api.example.test/api/resolve-places', resolveBody, '198.51.100.1'));
    const secondClientFirst = await resolve(request('https://api.example.test/api/resolve-places', resolveBody, '198.51.100.2'));

    expect(firstClientFirst.status).toBe(200);
    expect(firstClientSecond.status).toBe(429);
    expect(secondClientFirst.status).toBe(200);
  });

  it.each(['resolve-places', 'search-routes'] as const)(
    'uses Vercel forwarded client IP for %s despite a client-supplied x-forwarded-for',
    async (endpointName) => {
      const store = makeStore();
      const env = { VERCEL_ENV: 'preview' };
      const resolveFixture = endpointName === 'resolve-places'
        ? resolveEndpoint(env, store.store)
        : undefined;
      const searchFixture = endpointName === 'search-routes'
        ? searchEndpoint(env, store.store)
        : undefined;
      const handler = resolveFixture?.handler ?? searchFixture!.handler;
      const url = `https://api.example.test/api/${endpointName}`;
      const body = endpointName === 'resolve-places' ? resolveBody : searchBody;

      const response = await handler(request(url, body, '203.0.113.77', {
        'x-vercel-forwarded-for': '198.51.100.42',
      }));

      expect(response.status).toBe(200);
      expect(store.increment.mock.calls[0]?.[0]).toMatch(
        new RegExp(`^${endpointName}:198\\.51\\.100\\.42:\\d+$`),
      );
    },
  );

  it('does not let a saturated search-routes budget consume resolve-places quota in the same shared store', async () => {
    const store = makeStore().store;
    const env = {
      VERCEL_ENV: 'preview',
      RATE_LIMIT_RESOLVE_PLACES_PER_MINUTE: '1',
      RATE_LIMIT_SEARCH_ROUTES_PER_MINUTE: '1',
    };
    const search = searchEndpoint(env, store).handler;
    const resolve = resolveEndpoint(env, store).handler;
    const searchFirst = await search(request('https://api.example.test/api/search-routes', searchBody));
    const searchSecond = await search(request('https://api.example.test/api/search-routes', searchBody));
    const resolveFirst = await resolve(request('https://api.example.test/api/resolve-places', resolveBody));

    expect(searchFirst.status).toBe(200);
    expect(searchSecond.status).toBe(429);
    expect(resolveFirst.status).toBe(200);
  });
});
