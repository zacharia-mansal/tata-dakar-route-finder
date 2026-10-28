import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSearchRoutesHandler } from './search-routes';

afterEach(() => vi.useRealTimers());

const destination = {
  id: 'ism', displayName: 'Institut Supérieur de Management', areaName: 'Université',
  coordinates: { lat: 14.696, lon: -17.463 }, source: 'catalogue' as const,
};
const originPlace = {
  id: 'castor', displayName: 'Castor', areaName: 'SICAP',
  coordinates: { lat: 14.707, lon: -17.451 }, source: 'catalogue' as const,
};
const publishedOrigin = {
  ...originPlace,
  placeId: originPlace.id,
  aliases: ['Castor stop'],
  directionId: 'direction-24-out',
  alightingStopId: 'castor-stop',
  verifiedAt: '2026-10-22T12:00:00.000Z',
};
const publishedDestination = {
  ...destination,
  placeId: destination.id,
  aliases: ['ISM'],
  directionId: 'direction-24-out',
  alightingStopId: 'university',
  verifiedAt: '2026-10-22T12:00:00.000Z',
};
const publishedSnapshot = {
  directions: [],
  stops: [],
  servedPlaces: [publishedOrigin, publishedDestination],
};

type ResolvePlaces = Parameters<typeof createSearchRoutesHandler>[0]['resolvePlaces'];

function dependencies() {
  return {
    resolvePlaces: vi.fn<ResolvePlaces>((query) => Promise.resolve({ kind: 'matches', places: [query === 'castor' ? originPlace : destination] })),
    loadPublishedSnapshot: vi.fn().mockResolvedValue(publishedSnapshot),
    searchRoutes: vi.fn().mockResolvedValue([]),
    rateLimit: { check: vi.fn().mockResolvedValue({ allowed: true }) },
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  };
}

function post(body: unknown, headers?: Record<string, string>): Request {
  return new Request('https://api.example.test/v1/search-routes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  origin: { kind: 'coordinates', coordinates: { lat: 14.7, lon: -17.4 } },
  destination,
  locale: 'fr',
};

describe('search-routes targeted regressions', () => {
  it('never substitutes the first place when the requested destination id is absent', async () => {
    const deps = dependencies();
    deps.loadPublishedSnapshot.mockResolvedValue({
      ...publishedSnapshot,
      servedPlaces: [{ ...publishedDestination, id: 'different-place', placeId: 'different-place' }],
    });
    const response = await createSearchRoutesHandler(deps)(post(validBody));

    expect(response.status).toBe(404);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });

  it('rejects an oversized declared content-length without pulling the request stream', async () => {
    const deps = dependencies();
    deps.maxBodyBytes = 8;
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode('too large'));
        controller.close();
      },
    }, { highWaterMark: 0 });
    const request = new Request('https://api.example.test/v1/search-routes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '100' },
      body,
      duplex: 'half',
    } as RequestInit);

    const response = await createSearchRoutesHandler(deps)(request);

    expect(response.status).toBe(413);
    expect(pulls).toBe(0);
  });

  it('stops reading the stream as soon as the byte limit is exceeded', async () => {
    const deps = dependencies();
    deps.maxBodyBytes = 8;
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(new TextEncoder().encode('123456789'));
          return;
        }
        controller.enqueue(new TextEncoder().encode('second chunk must not be consumed'));
        controller.close();
      },
      cancel() {
        cancelled = true;
      },
    }, { highWaterMark: 0 });
    const request = new Request('https://api.example.test/v1/search-routes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duplex: 'half',
    } as RequestInit);

    const response = await createSearchRoutesHandler(deps)(request);

    expect(response.status).toBe(413);
    expect(pulls).toBe(1);
    expect(cancelled).toBe(true);
  });

  it('uses the Vercel x-forwarded-for client address and ignores x-real-ip', async () => {
    const deps = dependencies();
    await createSearchRoutesHandler(deps)(post(validBody, {
      'x-forwarded-for': '198.51.100.24, 10.0.0.12',
      'x-real-ip': '203.0.113.99',
    }));

    expect(deps.rateLimit.check).toHaveBeenCalledWith('198.51.100.24');
  });

  it('does not trust x-real-ip when Vercel x-forwarded-for is absent', async () => {
    const deps = dependencies();
    await createSearchRoutesHandler(deps)(post(validBody, { 'x-real-ip': '203.0.113.99' }));

    expect(deps.rateLimit.check).toHaveBeenCalledWith('unknown');
  });

  it('aborts the published snapshot read when the whole request reaches ten seconds', async () => {
    vi.useFakeTimers();
    const deps = dependencies();
    let snapshotSignal: AbortSignal | undefined;
    deps.loadPublishedSnapshot.mockImplementation((signal?: AbortSignal) => {
      snapshotSignal = signal;
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve(publishedSnapshot), { once: true });
      });
    });
    const pending = createSearchRoutesHandler(deps)(post(validBody));

    await vi.advanceTimersByTimeAsync(10_001);
    const response = await pending;

    expect(response.status).toBe(504);
    expect(snapshotSignal).toBeInstanceOf(AbortSignal);
    expect(snapshotSignal?.aborted).toBe(true);
  });

  it('uses the selected place origin by id with canonical snapshot fields', async () => {
    const deps = dependencies();
    const body = {
      ...validBody,
      origin: originPlace,
    };
    const response = await createSearchRoutesHandler(deps)(post(body));

    expect(response.status).toBe(200);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).toHaveBeenCalledTimes(1);
    expect(deps.searchRoutes.mock.calls[0][0].origin).toMatchObject({
      id: 'castor',
      displayName: 'Castor',
      areaName: 'SICAP',
      coordinates: { lat: 14.707, lon: -17.451 },
      aliases: ['Castor stop'],
    });
  });
});
