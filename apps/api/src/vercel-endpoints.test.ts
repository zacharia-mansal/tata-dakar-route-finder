import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { JourneyOption } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import type { PublishedTransitNetworkSnapshot } from './neon';
import { createSearchRoutesHandler } from './search-routes';
import type { SharedRateLimitStore } from './rateLimit';
import { createResolvePlacesEndpoint } from '../api/resolve-places';
import { createSearchRoutesEndpoint } from '../api/search-routes';

type SearchDependencies = Omit<Parameters<typeof createSearchRoutesHandler>[0], 'rateLimit'>;
type TestSearchDependencies = Omit<SearchDependencies, 'loadPublishedSnapshot'> & {
  loadPublishedSnapshot: Mock<SearchDependencies['loadPublishedSnapshot']>;
};

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

function sharedStore(): SharedRateLimitStore {
  const counters = new Map<string, number>();
  return {
    increment: vi.fn(async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }),
  };
}

function searchDependencies(): TestSearchDependencies {
  return {
    loadPublishedSnapshot: vi.fn<SearchDependencies['loadPublishedSnapshot']>().mockResolvedValue(snapshot),
    resolvePlaces: vi.fn(async () => ({ kind: 'matches', places: [] })),
    searchRoutes: vi.fn(async (): Promise<JourneyOption[]> => []),
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  };
}

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('thin Vercel API endpoint factories', () => {
  it('exposes Request-to-Response handlers with injectable resolver, Neon, Stadia, and shared-store fakes', async () => {
    const resolver = vi.fn(async () => ({ kind: 'matches', places: [place] }));
    const store = sharedStore();
    const resolvePlaces = createResolvePlacesEndpoint({
      env: { VERCEL_ENV: 'preview' },
      sharedRateLimitStore: store,
      stadiaApiKey: 'fixture-only-key',
      resolvePlaces: resolver,
    });
    const searchDeps = searchDependencies();
    const searchRoutes = createSearchRoutesEndpoint({
      env: { VERCEL_ENV: 'preview' },
      sharedRateLimitStore: store,
      dependencies: searchDeps,
    });

    const resolveResponse = await resolvePlaces(post('https://api.example.test/api/resolve-places', {
      query: 'ISM',
      locale: 'fr',
    }));
    const searchResponse = await searchRoutes(post('https://api.example.test/api/search-routes', {
      origin: { kind: 'coordinates', coordinates: { lat: 14.707, lon: -17.451 } },
      destination: place,
      locale: 'fr',
    }));

    expect(resolveResponse).toBeInstanceOf(Response);
    expect(resolveResponse.status).toBe(200);
    expect(resolver).toHaveBeenCalledWith('ISM', 'fr', expect.any(AbortSignal));
    expect(searchResponse).toBeInstanceOf(Response);
    expect(searchResponse.status).toBe(200);
    expect(searchDeps.loadPublishedSnapshot).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['fr', 'La recherche de lieux est temporairement indisponible.'],
    ['en', 'Place search is temporarily unavailable.'],
  ] as const)('returns a localized safe 503 without a Stadia key (%s)', async (locale, message) => {
    const resolver = vi.fn(async () => ({ kind: 'matches', places: [] }));
    const resolvePlaces = createResolvePlacesEndpoint({
      env: { VERCEL_ENV: 'development', ALLOW_MEMORY_RATE_LIMIT: '1' },
      stadiaApiKey: undefined,
      resolvePlaces: resolver,
    });
    const response = await resolvePlaces(post('https://api.example.test/api/resolve-places', {
      query: 'lieu inconnu',
      locale,
    }));
    const body = await response.json() as { error?: string; message?: string };

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'service_unavailable', message });
    expect(JSON.stringify(body)).not.toContain('STADIA_API_KEY');
    expect(resolver).not.toHaveBeenCalled();
  });

  it.each([
    ['fr', 'La recherche d’itinéraire est temporairement indisponible.'],
    ['en', 'Route search is temporarily unavailable.'],
  ] as const)('localizes a rate-limit-unavailable 503 for search-routes (%s)', async (locale, message) => {
    const dependencies = searchDependencies();
    const searchRoutes = createSearchRoutesEndpoint({
      env: { VERCEL_ENV: 'preview', ALLOW_MEMORY_RATE_LIMIT: '1' },
      dependencies,
    });
    const response = await searchRoutes(post('https://api.example.test/api/search-routes', {
      origin: { kind: 'coordinates', coordinates: { lat: 14.707, lon: -17.451 } },
      destination: place,
      locale,
    }));
    const body = await response.json() as { error?: string; message?: string };

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: 'service_unavailable', message });
    expect(Object.keys(body).sort()).toEqual(['error', 'message']);
    expect(dependencies.loadPublishedSnapshot).not.toHaveBeenCalled();
    expect(dependencies.searchRoutes).not.toHaveBeenCalled();
  });

  it.each([
    ['fr', 'La recherche d’itinéraire a échoué. Veuillez réessayer.'],
    ['en', 'Route search failed. Please try again.'],
  ] as const)('returns a localized safe response for an internal search error (%s)', async (locale, message) => {
    const internalMarker = 'fixture-only-internal-detail-do-not-return';
    const dependencies = searchDependencies();
    dependencies.loadPublishedSnapshot.mockRejectedValue(new Error(internalMarker));
    const searchRoutes = createSearchRoutesEndpoint({
      env: { VERCEL_ENV: 'preview' },
      sharedRateLimitStore: sharedStore(),
      dependencies,
    });
    const response = await searchRoutes(post('https://api.example.test/api/search-routes', {
      origin: { kind: 'coordinates', coordinates: { lat: 14.707, lon: -17.451 } },
      destination: place,
      locale,
    }));
    const responseText = await response.text();

    expect(response.status).toBe(500);
    expect(responseText).toContain(message);
    expect(responseText).not.toContain(internalMarker);
  });

  it('rejects an oversized Content-Length before reading the request body', async () => {
    const resolver = vi.fn(async () => ({ kind: 'matches', places: [place] }));
    const resolvePlaces = createResolvePlacesEndpoint({
      env: { VERCEL_ENV: 'preview' },
      sharedRateLimitStore: sharedStore(),
      stadiaApiKey: 'fixture-only-key',
      resolvePlaces: resolver,
    });
    const request = new Request('https://api.example.test/api/resolve-places', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(16 * 1024 + 1),
      },
      body: JSON.stringify({ query: 'ISM', locale: 'fr' }),
    });

    const response = await resolvePlaces(request);

    expect(response.status).toBe(413);
    expect(request.bodyUsed).toBe(false);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('accepts a valid JSON request whose body is exactly 16 KiB', async () => {
    const resolver = vi.fn(async () => ({ kind: 'matches', places: [place] }));
    const resolvePlaces = createResolvePlacesEndpoint({
      env: { VERCEL_ENV: 'preview' },
      sharedRateLimitStore: sharedStore(),
      stadiaApiKey: 'fixture-only-key',
      resolvePlaces: resolver,
    });
    const prefix = '{"query":"ISM","locale":"fr","padding":"';
    const suffix = '"}';
    const paddingLength = 16 * 1024 - new TextEncoder().encode(prefix + suffix).length;
    const body = `${prefix}${'x'.repeat(paddingLength)}${suffix}`;
    const bodyLength = new TextEncoder().encode(body).length;
    const request = new Request('https://api.example.test/api/resolve-places', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(bodyLength),
      },
      body,
    });

    const response = await resolvePlaces(request);

    expect(bodyLength).toBe(16 * 1024);
    expect(response.status).toBe(200);
    expect(resolver).toHaveBeenCalledWith('ISM', 'fr', expect.any(AbortSignal));
  });

  it('cancels an oversized streaming body without Content-Length before invoking the resolver', async () => {
    const resolver = vi.fn(async () => ({ kind: 'matches', places: [place] }));
    const resolvePlaces = createResolvePlacesEndpoint({
      env: { VERCEL_ENV: 'preview' },
      sharedRateLimitStore: sharedStore(),
      stadiaApiKey: 'fixture-only-key',
      resolvePlaces: resolver,
    });
    const bytes = new TextEncoder().encode(JSON.stringify({
      query: 'ISM',
      locale: 'fr',
      padding: 'x'.repeat(32 * 1024),
    }));
    const chunkSize = 1024;
    const totalChunks = Math.ceil(bytes.length / chunkSize);
    let offset = 0;
    let chunksProduced = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) {
          controller.close();
          return;
        }
        const end = Math.min(offset + chunkSize, bytes.length);
        controller.enqueue(bytes.slice(offset, end));
        offset = end;
        chunksProduced += 1;
      },
      cancel() {
        cancelled = true;
      },
    });
    const init = Object.assign({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stream,
    }, { duplex: 'half' as const });
    const request = new Request('https://api.example.test/api/resolve-places', init);

    const response = await resolvePlaces(request);

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(chunksProduced).toBeLessThan(totalChunks);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('does not invoke resolver, Neon, or routing dependencies when deployment rate limiting is unavailable', async () => {
    const resolver = vi.fn(async () => ({ kind: 'matches', places: [place] }));
    const resolvePlaces = createResolvePlacesEndpoint({
      env: { VERCEL_ENV: 'preview', ALLOW_MEMORY_RATE_LIMIT: '1' },
      stadiaApiKey: 'fixture-only-key',
      resolvePlaces: resolver,
    });
    const searchDeps = searchDependencies();
    const searchRoutes = createSearchRoutesEndpoint({
      env: { VERCEL_ENV: 'production', ALLOW_MEMORY_RATE_LIMIT: '1' },
      dependencies: searchDeps,
    });

    const resolveResponse = await resolvePlaces(post('https://api.example.test/api/resolve-places', {
      query: 'ISM',
      locale: 'fr',
    }));
    const searchResponse = await searchRoutes(post('https://api.example.test/api/search-routes', {
      origin: { kind: 'coordinates', coordinates: { lat: 14.707, lon: -17.451 } },
      destination: place,
      locale: 'fr',
    }));

    expect(resolveResponse.status).toBe(503);
    expect(searchResponse.status).toBe(503);
    expect(resolver).not.toHaveBeenCalled();
    expect(searchDeps.loadPublishedSnapshot).not.toHaveBeenCalled();
    expect(searchDeps.searchRoutes).not.toHaveBeenCalled();
  });
});
