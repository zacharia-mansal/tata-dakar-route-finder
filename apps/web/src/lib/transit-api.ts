import type { JourneyOption } from '../../../../packages/domain/src/journey'
import type { Coordinates } from '../../../../packages/domain/src/map'
import type { PlaceCandidate } from '../../../../packages/domain/src/place'
import type { NetworkId } from '../../../../packages/domain/src/transit'

export type TransitLocale = 'fr' | 'en'

export interface PublishedPlaceCandidate extends PlaceCandidate {
  placeId: string
  directionId: string
  alightingStopId: string
  verifiedAt: string
  aliases: string[]
}

export type SearchResultPlace = PlaceCandidate | PublishedPlaceCandidate

export type PlaceSelection =
  | { source: 'catalogue'; id: string }
  | { source: 'geocoder'; coordinates: Coordinates; displayName: string }

export type SearchOrigin =
  | { kind: 'coordinates'; coordinates: Coordinates }
  | PlaceSelection

export function selectionForPlace(place: PlaceCandidate): PlaceSelection {
  return place.source === 'catalogue'
    ? { source: 'catalogue', id: place.id }
    : { source: 'geocoder', coordinates: place.coordinates, displayName: place.displayName }
}

export function parsePlaceSelection(value: unknown): PlaceSelection | undefined {
  if (!isRecord(value)) return undefined
  if (value.source === 'catalogue' && typeof value.id === 'string' && value.id.trim()) {
    return { source: 'catalogue', id: value.id.trim() }
  }
  const coordinates = value.source === 'geocoder' ? parseCoordinates(value.coordinates) : undefined
  if (coordinates && typeof value.displayName === 'string' && value.displayName.trim()) {
    return { source: 'geocoder', coordinates, displayName: value.displayName.trim() }
  }
  return undefined
}

export type PlaceResolution =
  | { kind: 'matches'; places: PlaceCandidate[] }
  | { kind: 'ambiguous'; places: PlaceCandidate[] }

export type ContributionNetwork = 'aftu_dakar' | 'tata_thies'

export interface ContributionStopSummary {
  id: string
  network: ContributionNetwork
  qualityStatus: 'incomplete'
  name?: string | null
}

export type SearchRoutesResult =
  | { kind: 'no_verified_journey' }
  | {
      kind: 'routes'
      places: SearchResultPlace[]
      routes: JourneyOption[]
      partial?: true
      partialReason?: 'call_limit' | 'deadline' | 'walking_service_error'
    }

export interface TransitApiClientOptions {
  baseUrl: string | undefined
  fetch?: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>
  timeoutMs?: number
}

export class TransitApiConfigurationError extends Error {
  readonly code = 'invalid_api_configuration'

  constructor() {
    super('Le service de trajets n’est pas configuré correctement.')
    this.name = 'TransitApiConfigurationError'
  }
}

export class TransitApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'TransitApiError'
  }
}

const DEFAULT_TIMEOUT_MS = 12_000

function parseBaseUrl(value: string | undefined): URL {
  if (!value?.trim()) throw new TransitApiConfigurationError()
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new TransitApiConfigurationError()
  }

  const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new TransitApiConfigurationError()
  }

  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  return url
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCoordinates(value: unknown): Coordinates | undefined {
  if (!isRecord(value)) return undefined
  const { lat, lon } = value
  if (
    typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180
  ) return undefined
  return { lat, lon }
}

function parsePlace(value: unknown): PlaceCandidate | undefined {
  if (!isRecord(value)) return undefined
  const coordinates = parseCoordinates(value.coordinates)
  if (
    typeof value.id !== 'string' || !value.id ||
    typeof value.displayName !== 'string' || !value.displayName ||
    typeof value.areaName !== 'string' || !value.areaName ||
    !coordinates ||
    (value.source !== 'catalogue' && value.source !== 'geocoder') ||
    (value.matchedAlias !== undefined && typeof value.matchedAlias !== 'string')
  ) return undefined

  return {
    id: value.id,
    displayName: value.displayName,
    areaName: value.areaName,
    coordinates,
    source: value.source,
    ...(typeof value.matchedAlias === 'string' ? { matchedAlias: value.matchedAlias } : {}),
  }
}

function parseSearchResultPlace(value: unknown): SearchResultPlace | undefined {
  const candidate = parsePlace(value)
  if (!candidate || !isRecord(value)) return undefined
  const publishedKeys = ['placeId', 'directionId', 'alightingStopId', 'verifiedAt', 'aliases'] as const
  const present = publishedKeys.filter((key) => Object.hasOwn(value, key))
  if (present.length === 0) return candidate
  if (
    present.length !== publishedKeys.length ||
    typeof value.placeId !== 'string' || !value.placeId ||
    typeof value.directionId !== 'string' || !value.directionId ||
    typeof value.alightingStopId !== 'string' || !value.alightingStopId ||
    typeof value.verifiedAt !== 'string' || !Number.isFinite(Date.parse(value.verifiedAt)) ||
    !Array.isArray(value.aliases) || value.aliases.some((alias) => typeof alias !== 'string')
  ) return undefined

  return {
    ...candidate,
    placeId: value.placeId,
    directionId: value.directionId,
    alightingStopId: value.alightingStopId,
    verifiedAt: value.verifiedAt,
    aliases: value.aliases,
  }
}

function decodeError(locale: TransitLocale): TransitApiError {
  return new TransitApiError(
    'invalid_response',
    locale === 'fr' ? 'La réponse du service de trajets est invalide.' : 'The transit service returned an invalid response.',
  )
}

function isJourney(value: unknown): value is JourneyOption {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.servedAreaName !== 'string') return false
  if (!Array.isArray(value.legs) || value.legs.length === 0 || !isRecord(value.finalWalk)) return false
  return value.legs.every((leg) => {
    if (!isRecord(leg) || typeof leg.directionId !== 'string' || typeof leg.lineNumber !== 'string') return false
    if (
      typeof leg.directionName !== 'string' || typeof leg.displayedDestinationLabel !== 'string' ||
      typeof leg.receiverQuestion !== 'string' || !Array.isArray(leg.orderedStops) ||
      !isRecord(leg.boardingStop) || !isRecord(leg.alightingStop)
    ) return false
    return [leg.boardingStop, leg.alightingStop, ...leg.orderedStops].every((stop) =>
      isRecord(stop) && typeof stop.id === 'string' && typeof stop.name === 'string' &&
      parseCoordinates(stop.coordinates) !== undefined && Array.isArray(stop.aliases) &&
      stop.aliases.every((alias) => typeof alias === 'string'),
    )
  }) && typeof value.totalWalkMeters === 'number' && typeof value.verifiedAt === 'string'
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)
  const date = Date.parse(value)
  if (!Number.isFinite(date)) return undefined
  return Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

function fallbackErrorMessage(status: number, locale: TransitLocale): string {
  if (status === 429) return locale === 'fr' ? 'Trop de recherches. Réessaie dans un instant.' : 'Too many searches. Try again shortly.'
  if (status === 503) return locale === 'fr' ? 'Le service de trajets est temporairement indisponible.' : 'The transit service is temporarily unavailable.'
  if (status === 504) return locale === 'fr' ? 'La recherche a pris trop de temps.' : 'The search took too long.'
  return locale === 'fr' ? 'La recherche de trajet a échoué. Réessaie.' : 'Route search failed. Try again.'
}

function fallbackErrorCode(status: number): string {
  if (status === 429) return 'rate_limited'
  if (status === 503) return 'service_unavailable'
  if (status === 504) return 'request_timeout'
  return `http_${status}`
}

function safeServerMessage(body: unknown, query: string, locale: TransitLocale): string | undefined {
  if (!isRecord(body) || typeof body.message !== 'string') return undefined
  const message = body.message.trim()
  if (!message || message.length > 240 || (query && message.toLocaleLowerCase().includes(query.toLocaleLowerCase()))) return undefined
  return message
}

export function createTransitApiClient(options: TransitApiClientOptions) {
  const baseUrl = parseBaseUrl(options.baseUrl)
  const fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const post = async (path: string, body: unknown, locale: TransitLocale, query: string): Promise<unknown> => {
    const basePath = baseUrl.pathname === '/' ? '' : baseUrl.pathname
    const url = new URL(`${basePath}${path}`, baseUrl.origin)
    let response: Response
    try {
      response = await fetchImplementation(url, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json', 'accept-language': locale },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      const timedOut = isRecord(error) && (error.name === 'TimeoutError' || error.name === 'AbortError')
      throw new TransitApiError(
        timedOut ? 'request_timeout' : 'network_error',
        timedOut
          ? (locale === 'fr' ? 'La recherche a pris trop de temps.' : 'The search took too long.')
          : (locale === 'fr' ? 'Connexion au service de trajets impossible.' : 'Could not connect to the transit service.'),
      )
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      if (!response.ok) {
        throw new TransitApiError(fallbackErrorCode(response.status), fallbackErrorMessage(response.status, locale), response.status, parseRetryAfter(response.headers.get('retry-after')))
      }
      throw decodeError(locale)
    }

    if (!response.ok) {
      const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `http_${response.status}`
      const message = safeServerMessage(payload, query, locale) ?? fallbackErrorMessage(response.status, locale)
      throw new TransitApiError(code, message, response.status, parseRetryAfter(response.headers.get('retry-after')))
    }
    return payload
  }

  return {
    async resolvePlaces(query: string, locale: TransitLocale): Promise<PlaceResolution> {
      const payload = await post('/api/resolve-places', { query, locale }, locale, query)
      if (!isRecord(payload) || (payload.kind !== 'matches' && payload.kind !== 'ambiguous') || !Array.isArray(payload.places)) {
        throw decodeError(locale)
      }
      const places = payload.places.map(parsePlace)
      if (places.some((place) => place === undefined)) throw decodeError(locale)
      return { kind: payload.kind, places: places as PlaceCandidate[] }
    },

    async searchRoutes(request: {
      network: NetworkId
      origin: SearchOrigin
      destination: PlaceSelection
      locale: TransitLocale
    }): Promise<SearchRoutesResult> {
      const payload = await post('/api/search-routes', request, request.locale, '')
      if (!isRecord(payload)) throw decodeError(request.locale)
      if (payload.kind === 'no_verified_journey') return { kind: 'no_verified_journey' }
      if (payload.kind !== 'routes' || !Array.isArray(payload.places) || !Array.isArray(payload.routes)) throw decodeError(request.locale)

      const places = payload.places.map(parseSearchResultPlace)
      if (places.some((place) => place === undefined) || !payload.routes.every(isJourney)) throw decodeError(request.locale)
      if (payload.partial !== undefined && payload.partial !== true) throw decodeError(request.locale)
      const partialReason = payload.partialReason
      if (partialReason !== undefined && !['call_limit', 'deadline', 'walking_service_error'].includes(String(partialReason))) {
        throw decodeError(request.locale)
      }
      if (payload.partial === true && partialReason === undefined) throw decodeError(request.locale)
      return {
        kind: 'routes',
        places: places as SearchResultPlace[],
        routes: payload.routes as JourneyOption[],
        ...(payload.partial === true ? { partial: true, partialReason: partialReason as 'call_limit' | 'deadline' | 'walking_service_error' } : {}),
      }
    },

    async listContributionStops(network: ContributionNetwork): Promise<{
      network: ContributionNetwork
      stops: ContributionStopSummary[]
    }> {
      const basePath = baseUrl.pathname === '/' ? '' : baseUrl.pathname
      const url = new URL(`${basePath}/api/contribution-stops`, baseUrl.origin)
      url.searchParams.set('network', network)
      let response: Response
      try {
        response = await fetchImplementation(url, {
          method: 'GET',
          headers: { accept: 'application/json', 'accept-language': 'fr' },
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        const timedOut = isRecord(error) && (error.name === 'TimeoutError' || error.name === 'AbortError')
        throw new TransitApiError(
          timedOut ? 'request_timeout' : 'network_error',
          timedOut ? 'La recherche a pris trop de temps.' : 'Connexion au service de trajets impossible.',
        )
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        if (!response.ok) {
          throw new TransitApiError(fallbackErrorCode(response.status), fallbackErrorMessage(response.status, 'fr'), response.status)
        }
        throw decodeError('fr')
      }
      if (!response.ok) {
        throw new TransitApiError(fallbackErrorCode(response.status), fallbackErrorMessage(response.status, 'fr'), response.status)
      }
      if (!isRecord(payload) || payload.kind !== 'contribution_stops' || payload.network !== network || !Array.isArray(payload.stops)) {
        throw decodeError('fr')
      }

      const stops: ContributionStopSummary[] = []
      for (const value of payload.stops) {
        if (
          !isRecord(value) || typeof value.id !== 'string' || !value.id.trim() ||
          value.network !== network || value.qualityStatus !== 'incomplete' ||
          (value.name !== undefined && value.name !== null && typeof value.name !== 'string')
        ) throw decodeError('fr')
        stops.push({
          id: value.id,
          network,
          qualityStatus: 'incomplete',
          ...(value.name === undefined ? {} : { name: value.name as string | null }),
        })
      }
      return { network, stops }
    },
  }
}
