import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JourneyOption } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import type { PublishedTransitNetworkSnapshot } from '../src/neon';
import { createSearchRoutesHandler } from '../src/search-routes';
import { createResolvePlacesEndpoint } from './resolve-places';

const destination: PlaceCandidate = {
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
    ...destination,
    placeId: destination.id,
    aliases: ['ISM'],
    directionId: 'direction-24-out',
    alightingStopId: 'university',
    verifiedAt: '2026-10-22T12:00:00.000Z',
  }],
};

function makeSearchRequest(): Request {
  return new Request('https://api.example.test/api/search-routes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'en' },
    body: JSON.stringify({
      origin: { kind: 'coordinates', coordinates: { lat: 14.707, lon: -17.451 } },
      destination,
      locale: 'en',
    }),
  });
}

function makeResolveRequest(): Request {
  return new Request('https://api.example.test/api/resolve-places', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'en' },
    body: JSON.stringify({ query: 'ISM', locale: 'en' }),
  });
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
}

afterEach(() => vi.useRealTimers());

describe('global API request deadline', () => {
  it('aborts resolve-places after ten seconds, including a pending rate-store call', async () => {
    vi.useFakeTimers();
    let storeSignal: AbortSignal | undefined;
    let releaseStore: (count: number) => void = () => undefined;
    const store = {
      increment: vi.fn(async (_key: string, options?: { signal?: AbortSignal }) => {
        storeSignal = options?.signal;
        return new Promise<number>((resolve) => { releaseStore = resolve; });
      }),
    };
    const resolver = vi.fn(async () => ({ kind: 'matches', places: [destination] }));
    const endpointOptions = {
      env: { VERCEL_ENV: 'preview' },
      sharedRateLimitStore: store,
      stadiaApiKey: 'fixture-only-key',
      resolvePlaces: resolver,
      requestTimeoutMs: 10_000,
    };
    const handler = createResolvePlacesEndpoint(endpointOptions);
    let responseStatus: number | undefined;
    const pending = handler(makeResolveRequest()).then((response) => { responseStatus = response.status; });

    try {
      await flushMicrotasks();
      await vi.advanceTimersByTimeAsync(10_000);
      await flushMicrotasks();
      expect(responseStatus).toBe(504);
      expect(storeSignal?.aborted).toBe(true);
      expect(resolver).not.toHaveBeenCalled();
    } finally {
      releaseStore(1);
      await pending;
    }
  });

  it.each(['rate-limit', 'database', 'walking'] as const)(
    'covers %s work with the ten-second search-routes deadline and passes its signal',
    async (blockedStage) => {
      vi.useFakeTimers();
      let stageSignal: AbortSignal | undefined;
      let releaseBlockedWork: (() => void) | undefined;
      const rateLimit = {
        check: vi.fn(async (_key: string, options?: { signal?: AbortSignal }) => {
          stageSignal = options?.signal;
          if (blockedStage === 'rate-limit') {
            await new Promise<void>((resolve) => { releaseBlockedWork = resolve; });
          }
          return { allowed: true };
        }),
      };
      const loadPublishedSnapshot = vi.fn(async (signal?: AbortSignal) => {
        if (blockedStage === 'database') {
          stageSignal = signal;
          await new Promise<void>((resolve) => { releaseBlockedWork = resolve; });
        }
        return snapshot;
      });
      const searchRoutes = vi.fn(async (input: { signal?: AbortSignal }): Promise<JourneyOption[]> => {
        if (blockedStage === 'walking') {
          stageSignal = input.signal;
          await new Promise<void>((resolve) => { releaseBlockedWork = resolve; });
        }
        return [];
      });
      const handler = createSearchRoutesHandler({
        rateLimit,
        loadPublishedSnapshot,
        resolvePlaces: vi.fn(async () => ({ kind: 'matches', places: [] })),
        searchRoutes,
        maxBodyBytes: 16_384,
        requestTimeoutMs: 10_000,
      });
      let responseStatus: number | undefined;
      const pending = handler(makeSearchRequest()).then((response) => { responseStatus = response.status; });

      try {
        await flushMicrotasks();
        await vi.advanceTimersByTimeAsync(10_000);
        await flushMicrotasks();
        expect(responseStatus).toBe(504);
        expect(stageSignal?.aborted).toBe(true);
      } finally {
        releaseBlockedWork?.();
        await pending;
      }
    },
  );

  it('marks a timed-out search response explicitly as partial because of the deadline', async () => {
    vi.useFakeTimers();
    let releaseSearch: (() => void) | undefined;
    const handler = createSearchRoutesHandler({
      rateLimit: { check: async () => ({ allowed: true }) },
      loadPublishedSnapshot: async () => snapshot,
      resolvePlaces: async () => ({ kind: 'matches', places: [] }),
      searchRoutes: async () => new Promise<JourneyOption[]>((resolve) => {
        releaseSearch = () => resolve([]);
      }),
      maxBodyBytes: 16_384,
      requestTimeoutMs: 10_000,
    });

    const pending = handler(makeSearchRequest());
    try {
      await flushMicrotasks();
      await vi.advanceTimersByTimeAsync(10_000);
      const response = await pending;
      const body: unknown = await response.json();

      expect(response.status).toBe(504);
      expect(body).toMatchObject({ partial: true, partialReason: 'deadline' });
    } finally {
      releaseSearch?.();
    }
  });
});
