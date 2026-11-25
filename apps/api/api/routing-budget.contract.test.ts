import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JourneyOption, TransitNetwork, WalkSegment } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import type { PublishedTransitNetworkSnapshot } from '../src/neon';
import { searchRoutes } from '../src/routing';
import { createSearchRoutesHandler } from '../src/search-routes';

const originCoordinates = { lat: 14.707, lon: -17.451 };
const destinationCoordinates = { lat: 14.695, lon: -17.463 };
const destination: PlaceCandidate = {
  id: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates: destinationCoordinates,
  source: 'catalogue',
};

function makeNetwork(candidateCount: number, duplicateStops = false): PublishedTransitNetworkSnapshot {
  const directions = Array.from({ length: candidateCount }, (_, index) => {
    const start = duplicateStops
      ? originCoordinates
      : { lat: originCoordinates.lat + index * 0.00002, lon: originCoordinates.lon };
    const finish = duplicateStops
      ? destinationCoordinates
      : { lat: destinationCoordinates.lat + index * 0.00003, lon: destinationCoordinates.lon };
    return {
      id: `direction-${index}`,
      network: 'aftu_dakar' as const,
      networkName: 'AFTU Dakar',
      qualityStatus: 'confirmed' as const,
      source: 'test_fixture',
      lineNumber: String(24 + index),
      directionName: `Castor vers Université ${index}`,
      displayedDestinationLabel: 'Université',
      receiverQuestion: 'Est-ce que ça va vers l’Université ?',
      stops: [
        { id: `start-${index}`, network: 'aftu_dakar' as const, qualityStatus: 'confirmed' as const, source: 'test_fixture', sourceReference: 'fixture-only', name: 'Castor', coordinates: start, aliases: [] },
        { id: `end-${index}`, network: 'aftu_dakar' as const, qualityStatus: 'confirmed' as const, source: 'test_fixture', sourceReference: 'fixture-only', name: 'Université', coordinates: finish, aliases: [] },
      ],
    };
  });

  return {
    directions,
    stops: directions.flatMap(({ stops }) => stops),
    servedPlaces: directions.map((direction, index) => ({
      id: 'ism',
      placeId: 'ism',
      displayName: destination.displayName,
      areaName: 'Université',
      coordinates: destination.coordinates,
      aliases: ['ISM'],
      source: 'catalogue' as const,
      directionId: direction.id,
      alightingStopId: `end-${index}`,
      verifiedAt: '2026-10-22T12:00:00.000Z',
    })),
  };
}

function walk(from: { lat: number; lon: number }, to: { lat: number; lon: number }): WalkSegment {
  return { distanceMeters: 100, instructions: ['Walk'], coordinates: [from, to] };
}

function routeSearch(input: {
  network: TransitNetwork;
  origin: { kind: 'coordinates'; coordinates: { lat: number; lon: number } } | PlaceCandidate;
  destination: PlaceCandidate;
  locale: 'fr' | 'en';
  signal?: AbortSignal;
}, walking: { route: (request: { from: { lat: number; lon: number }; to: { lat: number; lon: number }; locale: 'fr' | 'en'; signal?: AbortSignal }) => Promise<WalkSegment> }): Promise<JourneyOption[]> {
  return searchRoutes({ ...input, walking });
}

type MetadataSearchOptions = Parameters<typeof searchRoutes>[0] & {
  maxExternalCallsPerRequest: number;
};

async function searchRoutesWithMetadata(options: MetadataSearchOptions): Promise<unknown> {
  const implementation: unknown = Reflect.get(await import('../src/routing'), 'searchRoutesWithMetadata');
  expect(typeof implementation).toBe('function');
  if (typeof implementation !== 'function') {
    throw new TypeError('routing.ts must export searchRoutesWithMetadata');
  }
  return await Reflect.apply(implementation, undefined, [options]);
}

function metadataRoutes(result: unknown): unknown[] {
  if (typeof result !== 'object' || result === null) return [];
  const routes = Reflect.get(result, 'routes');
  return Array.isArray(routes) ? routes : [];
}

function metadataRouteDirectionIds(result: unknown): unknown[] {
  return metadataRoutes(result).map((route) => {
    if (typeof route !== 'object' || route === null) return undefined;
    const legs = Reflect.get(route, 'legs');
    if (!Array.isArray(legs) || typeof legs[0] !== 'object' || legs[0] === null) return undefined;
    return Reflect.get(legs[0], 'directionId');
  });
}

function request(): Request {
  return new Request('https://api.example.test/api/search-routes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'fr' },
    body: JSON.stringify({
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination,
      locale: 'fr',
    }),
  });
}

function makeHandler(options: {
  snapshot: PublishedTransitNetworkSnapshot;
  walking: { route: (input: { from: { lat: number; lon: number }; to: { lat: number; lon: number }; locale: 'fr' | 'en'; signal?: AbortSignal }) => Promise<WalkSegment> };
}) {
  return createSearchRoutesHandler({
    rateLimit: { check: async () => ({ allowed: true }) },
    loadPublishedSnapshot: async () => options.snapshot,
    resolvePlaces: async () => ({ kind: 'matches', places: [] }),
    searchRoutes: (input) => routeSearch(input, options.walking),
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  });
}

afterEach(() => vi.useRealTimers());

describe('per-request walking provider budget', () => {
  it('caps external walking calls at 12, deduplicates coordinate pairs and marks returned routes partial', async () => {
    const walking = { route: vi.fn(async ({ from, to }: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }) => walk(from, to)) };
    const result = await searchRoutesWithMetadata({
      network: makeNetwork(10),
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination,
      locale: 'fr',
      walking,
      maxExternalCallsPerRequest: 12,
    });
    const coordinatePairs = walking.route.mock.calls.map(([call]) =>
      `${call.from.lat},${call.from.lon}>${call.to.lat},${call.to.lon}`,
    );

    expect(walking.route).toHaveBeenCalledTimes(12);
    expect(new Set(coordinatePairs).size).toBe(coordinatePairs.length);
    expect(result).toMatchObject({ partial: true, partialReason: 'call_limit' });
    expect(result).toMatchObject({ routes: expect.any(Array) });
    expect(metadataRoutes(result)).toHaveLength(3);
    expect(metadataRouteDirectionIds(result)).toEqual([
      'direction-0',
      'direction-1',
      'direction-2',
    ]);
  });

  it('does not call Stadia twice for the same origin-stop and destination-stop coordinate pairs', async () => {
    const walking = { route: vi.fn(async ({ from, to }: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }) => walk(from, to)) };
    const result = await searchRoutes({
      network: makeNetwork(4, true),
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination,
      locale: 'fr',
      walking,
    });

    expect(walking.route).toHaveBeenCalledTimes(2);
    expect(Array.isArray(result)).toBe(true);
  });

  it('keeps the successful candidate when another walking call fails and hides provider details', async () => {
    const failedCandidateStop = { lat: originCoordinates.lat + 0.00002, lon: originCoordinates.lon };
    const walking = {
      route: vi.fn(async ({ from, to }: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }) => {
        if (from.lat === originCoordinates.lat && from.lon === originCoordinates.lon &&
          to.lat === failedCandidateStop.lat && to.lon === failedCandidateStop.lon) {
          throw new Error('private Stadia provider detail');
        }
        return walk(from, to);
      }),
    };
    const result = await searchRoutesWithMetadata({
      network: makeNetwork(2),
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination,
      locale: 'fr',
      walking,
      maxExternalCallsPerRequest: 12,
    });

    expect(result).toMatchObject({ partial: true, partialReason: 'walking_service_error' });
    expect(metadataRouteDirectionIds(result)).toEqual(['direction-0']);
    expect(JSON.stringify(result)).not.toContain('private Stadia provider detail');
  });

  it('returns a localized error distinct from no_verified_journey when no complete route is evaluated', async () => {
    const walking = { route: vi.fn(async () => { throw new Error('private walking-provider detail'); }) };
    const dependencies: Parameters<typeof createSearchRoutesHandler>[0] = {
      rateLimit: { check: async () => ({ allowed: true }) },
      loadPublishedSnapshot: async () => makeNetwork(1),
      resolvePlaces: async () => ({ kind: 'matches', places: [] }),
      searchRoutes: async () => [],
      maxBodyBytes: 16_384,
      requestTimeoutMs: 10_000,
    };
    Object.assign(dependencies, {
      searchRoutes: (input: Parameters<typeof searchRoutes>[0]) => searchRoutesWithMetadata({
        ...input,
        network: makeNetwork(1),
        walking,
        maxExternalCallsPerRequest: 12,
      }),
    });
    const handler = createSearchRoutesHandler(dependencies);

    const response = await handler(request());
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(responseText).toContain('partialReason');
    expect(responseText).toContain('walking_service_error');
    expect(responseText).toContain('La recherche de trajet est temporairement indisponible.');
    expect(responseText).not.toContain('private walking-provider detail');
    expect(responseText).not.toContain('no_verified_journey');
  });
});
