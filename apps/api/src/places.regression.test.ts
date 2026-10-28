import { describe, expect, it, vi } from 'vitest';
import { createStadiaGeocoder } from './places';

const fixtureApiKey = 'fixture-stadia-key';

function geocoderWithFetchMock() {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
  return { fetchMock, geocoder: createStadiaGeocoder({ apiKey: fixtureApiKey, fetch: fetchMock }) };
}

describe('Stadia geocoder targeted regressions', () => {
  it('sends the Stadia-Auth authorization header', async () => {
    const { fetchMock, geocoder } = geocoderWithFetchMock();

    await geocoder.search('Castor', 'fr');

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(new Headers(requestInit?.headers).get('authorization')).toBe(`Stadia-Auth ${fixtureApiKey}`);
    expect(requestUrl).toBeDefined();
  });

  it('does not put the Stadia key in a URL query parameter', async () => {
    const { fetchMock, geocoder } = geocoderWithFetchMock();

    await geocoder.search('Castor', 'fr');

    const [requestUrl] = fetchMock.mock.calls[0];
    expect(new URL(String(requestUrl)).searchParams.has('api_key')).toBe(false);
  });

  it('passes the caller AbortSignal to the injected fetch', async () => {
    const controller = new AbortController();
    const { fetchMock, geocoder } = geocoderWithFetchMock();

    await geocoder.search('Castor', 'fr', controller.signal);

    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(requestSignal).toBeInstanceOf(AbortSignal);
    expect(requestSignal).not.toBe(controller.signal);
  });
});