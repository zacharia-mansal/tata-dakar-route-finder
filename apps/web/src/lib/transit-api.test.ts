import { describe, expect, it, vi } from 'vitest'
import { createTransitApiClient, TransitApiConfigurationError, TransitApiError } from './transit-api'

const candidate = {
  id: 'place-one',
  displayName: 'Marché Fictif',
  areaName: 'Zone Fictive',
  coordinates: { lat: 14.7, lon: -17.4 },
  source: 'catalogue',
}

describe('Transit API client', () => {
  it('sends place resolution to the contract endpoint with locale headers', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => Response.json({ kind: 'matches', places: [candidate] }))
    const client = createTransitApiClient({ baseUrl: 'https://api.example.test/', fetch })

    await expect(client.resolvePlaces('Marché Fictif', 'fr')).resolves.toMatchObject({
      kind: 'matches',
      places: [{ id: 'place-one', displayName: 'Marché Fictif' }],
    })
    expect(fetch).toHaveBeenCalledOnce()
    const [input, init] = fetch.mock.calls[0]!
    expect(String(input)).toBe('https://api.example.test/api/resolve-places')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('accept-language')).toBe('fr')
    expect(JSON.parse(String(init?.body))).toEqual({ query: 'Marché Fictif', locale: 'fr' })
  })

  it('sends route selections to the contract endpoint and parses no verified journey', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => Response.json({ kind: 'no_verified_journey' }))
    const client = createTransitApiClient({ baseUrl: 'https://api.example.test', fetch })
    const request = {
      network: 'aftu_dakar' as const,
      origin: { source: 'catalogue', id: 'origin-id' } as const,
      destination: { source: 'geocoder', coordinates: candidate.coordinates, displayName: 'École Fictive' } as const,
      locale: 'fr' as const,
    }

    await expect(client.searchRoutes(request)).resolves.toEqual({ kind: 'no_verified_journey' })
    const [input, init] = fetch.mock.calls[0]!
    expect(String(input)).toBe('https://api.example.test/api/search-routes')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(request)
  })

  it('loads incomplete contribution stops for only the selected network', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => Response.json({
      kind: 'contribution_stops',
      network: 'tata_thies',
      stops: [{ id: 'FICTIF-stop-1', network: 'tata_thies', qualityStatus: 'incomplete' }],
    }))
    const client = createTransitApiClient({ baseUrl: 'https://api.example.test', fetch })

    await expect(client.listContributionStops('tata_thies')).resolves.toEqual({
      network: 'tata_thies',
      stops: [{ id: 'FICTIF-stop-1', network: 'tata_thies', qualityStatus: 'incomplete' }],
    })
    const [input, init] = fetch.mock.calls[0]!
    expect(String(input)).toBe('https://api.example.test/api/contribution-stops?network=tata_thies')
    expect(init?.method).toBe('GET')
  })

  it('rejects contribution responses containing another network or a confirmed stop', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => Response.json({
      kind: 'contribution_stops',
      network: 'aftu_dakar',
      stops: [{ id: 'FICTIF-stop-1', network: 'tata_thies', qualityStatus: 'incomplete' }],
    }))
    const client = createTransitApiClient({ baseUrl: 'https://api.example.test', fetch })

    await expect(client.listContributionStops('aftu_dakar')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('rejects an absent or unsafe API URL before making a request', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => Response.json({ kind: 'matches', places: [] }))
    for (const baseUrl of [undefined, 'http://api.example.test', 'not a URL']) {
      expect(() => createTransitApiClient({ baseUrl, fetch })).toThrow(TransitApiConfigurationError)
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows plain HTTP only for loopback development', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => Response.json({ kind: 'matches', places: [] }))
    const client = createTransitApiClient({ baseUrl: 'http://127.0.0.1:3001', fetch })
    await expect(client.resolvePlaces('lieu', 'fr')).resolves.toMatchObject({ kind: 'matches', places: [] })
  })

  it('keeps 429 metadata but never exposes raw error response content', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => new Response(JSON.stringify({ error: 'rate_limited', message: 'Réessaie plus tard.', secret: 'raw-body-marker' }), {
      status: 429,
      headers: { 'retry-after': '9' },
    }))
    const client = createTransitApiClient({ baseUrl: 'https://api.example.test', fetch })

    const error = await client.resolvePlaces('texte privé', 'fr').catch((value: unknown) => value)
    expect(error).toBeInstanceOf(TransitApiError)
    expect(error).toMatchObject({ status: 429, code: 'rate_limited', retryAfterSeconds: 9, message: 'Réessaie plus tard.' })
    expect(String(error)).not.toContain('raw-body-marker')
    expect(String(error)).not.toContain('texte privé')
  })

  it('uses a safe localized fallback when an error body is malformed', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => new Response('raw-body-marker', { status: 503 }))
    const client = createTransitApiClient({ baseUrl: 'https://api.example.test', fetch })

    const error = await client.resolvePlaces('texte privé', 'en').catch((value: unknown) => value)
    expect(error).toMatchObject({ status: 503, code: 'service_unavailable' })
    expect(String(error)).not.toContain('raw-body-marker')
    expect(String(error)).not.toContain('texte privé')
  })

  it('rejects unknown successful response shapes with a controlled decode error', async () => {
    const fetch = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) => Response.json({ kind: 'unexpected', payload: 'raw-body-marker' }))
    const client = createTransitApiClient({ baseUrl: 'https://api.example.test', fetch })

    const error = await client.resolvePlaces('texte privé', 'fr').catch((value: unknown) => value)
    expect(error).toMatchObject({ code: 'invalid_response' })
    expect(String(error)).not.toContain('raw-body-marker')
    expect(String(error)).not.toContain('texte privé')
  })
})
