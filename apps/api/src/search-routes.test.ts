import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSearchRoutesHandler } from './search-routes';

afterEach(() => {
  vi.useRealTimers();
});

describe('search-routes handler', () => {
  const dependencies = () => ({
    resolvePlaces: vi.fn().mockResolvedValue({ kind: 'matches', places: [{ id: 'ism' }] }),
    searchRoutes: vi.fn().mockResolvedValue([]),
    rateLimit: { check: vi.fn().mockResolvedValue({ allowed: true }) },
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  });

  it('rejects unsupported HTTP methods before invoking services', async () => {
    const deps = dependencies();
    const handler = createSearchRoutesHandler(deps);

    const response = await handler(new Request('https://api.example.test/v1/search-routes', { method: 'GET' }));

    expect(response.status).toBe(405);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
  });

  it('validates request JSON and field bounds before resolving places', async () => {
    const deps = dependencies();
    const handler = createSearchRoutesHandler(deps);
    const response = await handler(new Request('https://api.example.test/v1/search-routes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ origin: { kind: 'coordinates', coordinates: { lat: 1000, lon: 0 } }, destination: { placeId: '' }, locale: 'fr' }),
    }));

    expect(response.status).toBe(400);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });

  it('rejects oversized request bodies without calling an external provider', async () => {
    const deps = dependencies();
    deps.maxBodyBytes = 8;
    const handler = createSearchRoutesHandler(deps);
    const response = await handler(new Request('https://api.example.test/v1/search-routes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'fr' }),
    }));

    expect(response.status).toBe(413);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
  });

  it('enforces the injected shared rate limit and returns 429 before database or Stadia work', async () => {
    const deps = dependencies();
    deps.rateLimit.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const handler = createSearchRoutesHandler(deps);
    const response = await handler(new Request('https://api.example.test/v1/search-routes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ origin: { kind: 'coordinates', coordinates: { lat: 14.7, lon: -17.4 } }, destination: { placeId: 'ism' }, locale: 'fr' }),
    }));

    expect(response.status).toBe(429);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });
  it('returns a gateway timeout when the complete request exceeds ten seconds', async () => {
    vi.useFakeTimers();
    const deps = dependencies();
    deps.resolvePlaces.mockReturnValue(new Promise<never>(() => undefined));
    const handler = createSearchRoutesHandler(deps);
    const pendingResponse = handler(new Request('https://api.example.test/v1/search-routes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        origin: { kind: 'coordinates', coordinates: { lat: 14.7, lon: -17.4 } },
        destination: { placeId: 'ism' },
        locale: 'fr',
      }),
    }));

    const timedOut = expect(pendingResponse).resolves.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(10_001);
    await timedOut;
    expect(deps.resolvePlaces).toHaveBeenCalledTimes(1);
  });
});
