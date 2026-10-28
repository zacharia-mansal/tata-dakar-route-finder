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

type ResolvePlaces = Parameters<typeof createSearchRoutesHandler>[0]['resolvePlaces'];

function dependencies() {
  return {
    resolvePlaces: vi.fn<ResolvePlaces>((query) => Promise.resolve({ kind: 'matches', places: [query === 'castor' ? originPlace : destination] })),
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
  destination: { placeId: 'ism' },
  locale: 'fr',
};

describe('search-routes targeted regressions', () => {
  it('never substitutes the first place when the requested destination id is absent', async () => {
    const deps = dependencies();
    deps.resolvePlaces.mockResolvedValue({
      kind: 'matches',
      places: [{ ...destination, id: 'different-place' }],
    });
    const response = await createSearchRoutesHandler(deps)(post(validBody));

    expect(response.status).toBe(404);
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

  it('aborts downstream place resolution when the whole request reaches ten seconds', async () => {
    vi.useFakeTimers();
    const deps = dependencies();
    let downstreamSignal: AbortSignal | undefined;
    deps.resolvePlaces.mockImplementation((_query: string, _locale: string, signal?: AbortSignal) => {
      downstreamSignal = signal;
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve({ kind: 'matches', places: [destination] }), { once: true });
      });
    });
    const pending = createSearchRoutesHandler(deps)(post(validBody));

    await vi.advanceTimersByTimeAsync(10_001);
    const response = await pending;

    expect(response.status).toBe(504);
    expect(downstreamSignal).toBeInstanceOf(AbortSignal);
    expect(downstreamSignal?.aborted).toBe(true);
  });

  it('resolves a place origin exactly or refuses it before route search', async () => {
    const deps = dependencies();
    const body = {
      ...validBody,
      origin: { kind: 'place', placeId: 'castor' },
    };
    const response = await createSearchRoutesHandler(deps)(post(body));

    if (response.status === 200) {
      expect(deps.searchRoutes).toHaveBeenCalledTimes(1);
      const routedOrigin = deps.searchRoutes.mock.calls[0][0].origin;
      const resolvedExactly =
        routedOrigin?.id === originPlace.id ||
        (routedOrigin?.coordinates?.lat === originPlace.coordinates.lat && routedOrigin?.coordinates?.lon === originPlace.coordinates.lon);
      expect(resolvedExactly).toBe(true);
    } else {
      expect([400, 422]).toContain(response.status);
      expect(deps.searchRoutes).not.toHaveBeenCalled();
    }
  });
});