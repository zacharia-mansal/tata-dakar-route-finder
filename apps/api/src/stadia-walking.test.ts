import { describe, expect, it, vi } from 'vitest';
import * as routing from './routing';

const apiKey = 'fixture-stadia-walking-key';
const polyline6 = '_}e`[~j_e`@o}@o}@';

const request = {
  from: { lat: 14.7, lon: -17.4 },
  to: { lat: 14.701, lon: -17.399 },
  locale: 'fr' as const,
};

async function routeWith(
  fetchMock: typeof fetch,
  signal?: AbortSignal,
  locale: 'fr' | 'en' = request.locale,
): Promise<unknown> {
  const createProvider = Reflect.get(routing, 'createStadiaWalkingProvider');
  expect(typeof createProvider).toBe('function');
  if (typeof createProvider !== 'function') {
    throw new TypeError('routing.ts must export createStadiaWalkingProvider');
  }

  const provider: unknown = Reflect.apply(createProvider, undefined, [{
    apiKey,
    fetch: fetchMock,
    requestTimeoutMs: 4_000,
  }]);
  if (typeof provider !== 'object' || provider === null) {
    throw new TypeError('walking provider must be an object');
  }
  const route = Reflect.get(provider, 'route');
  expect(typeof route).toBe('function');
  if (typeof route !== 'function') throw new TypeError('walking provider must expose route()');
  return await Reflect.apply(route, provider, [{ ...request, locale, signal }]);
}

describe('Stadia pedestrian route adapter', () => {
  it.each([
    { locale: 'fr' as const, language: 'fr-FR' },
    { locale: 'en' as const, language: 'en-GB' },
  ])('maps the $locale app locale to Stadia language $language', async ({ locale, language }) => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      trip: {
        summary: { length: 0.321, time: 180 },
        legs: [{ shape: polyline6 }],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    await routeWith(fetchMock, undefined, locale);
    const bodyText = typeof fetchMock.mock.calls[0]?.[1]?.body === 'string'
      ? fetchMock.mock.calls[0][1]?.body as string
      : '';
    const body: unknown = JSON.parse(bodyText);

    expect(body).toMatchObject({ language });
  });

  it('posts pedestrian locations with server authentication and decodes compact polyline6 geometry', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      trip: {
        summary: { length: 0.321, time: 180 },
        legs: [{ shape: polyline6 }],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await routeWith(fetchMock);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    const body: unknown = JSON.parse(bodyText);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(url)).toBe('https://api.stadiamaps.com/route/v1');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe(`Stadia-Auth ${apiKey}`);
    expect(body).toMatchObject({
      locations: [
        { ...request.from, type: 'break' },
        { ...request.to, type: 'break' },
      ],
      costing: 'pedestrian',
      units: 'kilometers',
    });
    expect(result).toMatchObject({
      distanceMeters: 321,
      coordinates: [
        { lat: 14.7, lon: -17.4 },
        { lat: 14.701, lon: -17.399 },
      ],
    });
  });

  it('does not expose provider response details when the routing service fails', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ error: 'private provider response detail' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    ));

    let thrown: unknown;
    try {
      await routeWith(fetchMock);
    } catch (error) {
      thrown = error;
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).not.toContain('private provider response detail');
    expect(String(thrown)).not.toContain(apiKey);
  });

  it('passes a child AbortSignal to fetch and cancels the route when the caller aborts', async () => {
    const controller = new AbortController();
    let fetchSignal: AbortSignal | undefined;
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      fetchSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        fetchSignal?.addEventListener('abort', () => reject(new Error('mock fetch aborted')), { once: true });
      });
    });

    const pending = routeWith(fetchMock, controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    await expect(pending).rejects.toThrow();
    expect(fetchSignal).toBeInstanceOf(AbortSignal);
    expect(fetchSignal).not.toBe(controller.signal);
    expect(fetchSignal?.aborted).toBe(true);
  });
});
