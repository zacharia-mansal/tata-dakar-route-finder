import { describe, expect, it, vi } from 'vitest';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import type { PublishedTransitNetworkSnapshot } from '../src/neon';
import { createRuntimeDependencies, createSearchRoutesEndpoint } from './search-routes';

const originCoordinates = { lat: 14.707, lon: -17.451 };
const destination: PlaceCandidate = {
  id: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates: { lat: 14.695, lon: -17.463 },
  source: 'catalogue',
};

const snapshot: PublishedTransitNetworkSnapshot = {
  directions: [{
    id: 'direction-24-out',
    lineNumber: '24',
    directionName: 'Castor vers Université',
    displayedDestinationLabel: 'Université',
    receiverQuestion: 'Est-ce que ça va vers l’Université ?',
    stops: [
      { id: 'castor', name: 'Castor', coordinates: originCoordinates, aliases: [] },
      { id: 'university', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] },
    ],
  }],
  stops: [
    { id: 'castor', name: 'Castor', coordinates: originCoordinates, aliases: [] },
    { id: 'university', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] },
  ],
  servedPlaces: [{
    ...destination,
    placeId: destination.id,
    aliases: ['ISM'],
    directionId: 'direction-24-out',
    alightingStopId: 'university',
    verifiedAt: '2026-10-22T12:00:00.000Z',
  }],
};

const compactRoute = {
  trip: {
    summary: { length: 0.321, time: 180 },
    legs: [{ shape: '_}e`[~j_e`@o}@o}@' }],
  },
};

function request(): Request {
  return new Request('https://api.example.test/api/search-routes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'fr', 'x-forwarded-for': '198.51.100.24' },
    body: JSON.stringify({
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination: { source: 'catalogue', id: destination.id },
      locale: 'fr',
    }),
  });
}

function runtimeEndpoint(options: {
  env: Readonly<Record<string, string | undefined>>;
  fetchMock: typeof fetch;
}) {
  const dependencies = Reflect.apply(createRuntimeDependencies, undefined, [options.env, {
    createReader: () => ({ load: async () => snapshot }),
    walkingFetch: options.fetchMock,
  }]) as ReturnType<typeof createRuntimeDependencies>;
  return createSearchRoutesEndpoint({
    env: { ...options.env, VERCEL_ENV: 'preview' },
    sharedRateLimitStore: { increment: vi.fn(async () => 1) },
    dependencies,
  });
}

describe('runtime Stadia walking route wiring', () => {
  it('uses the configured server key and injected fetch for published-route searches', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify(compactRoute),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const globalFetchMock = vi.fn<typeof fetch>(() => {
      throw new Error('Runtime must use its injected fetch');
    });
    vi.stubGlobal('fetch', globalFetchMock);

    try {
      const response = await runtimeEndpoint({
        env: {
          DATABASE_URL_PUBLIC_API: 'fixture-database-connection',
          STADIA_API_KEY: 'fixture-runtime-stadia-key',
        },
        fetchMock,
      })(request());
      const body: unknown = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ kind: 'routes', routes: expect.any(Array) });
      expect(fetchMock).toHaveBeenCalled();
      expect(globalFetchMock).not.toHaveBeenCalled();
      expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('authorization'))
        .toBe('Stadia-Auth fixture-runtime-stadia-key');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns a clean 503 when the Stadia server key is absent', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => {
      throw new Error('The walking provider must not be called without a key');
    });
    const response = await runtimeEndpoint({
      env: { DATABASE_URL_PUBLIC_API: 'fixture-database-connection' },
      fetchMock,
    })(request());
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ error: 'service_unavailable' });
    expect(JSON.stringify(body)).not.toContain('fixture-database-connection');
    expect(JSON.stringify(body)).not.toContain('STADIA_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
