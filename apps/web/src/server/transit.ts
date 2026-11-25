import { createServerFn } from '@tanstack/react-start'
import {
  createTransitApiClient,
  TransitApiConfigurationError,
  TransitApiError,
  type PlaceSelection,
  type SearchOrigin,
  type ContributionNetwork,
  type TransitLocale,
} from '@/lib/transit-api'
import type { NetworkId } from '../../../../packages/domain/src/transit'

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; retryAfterSeconds?: number }

function client() {
  return createTransitApiClient({ baseUrl: process.env.TATA_TRANSIT_API_BASE_URL })
}

function serviceError(error: unknown, locale: TransitLocale): { code: string; message: string; retryAfterSeconds?: number } {
  if (error instanceof TransitApiError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds }),
    }
  }
  if (error instanceof TransitApiConfigurationError) {
    return {
      code: error.code,
      message: locale === 'fr'
        ? 'La recherche de trajets n’est pas configurée pour cette application.'
        : 'Route search is not configured for this app.',
    }
  }
  return {
    code: 'service_unavailable',
    message: locale === 'fr'
      ? 'Le service de trajets est temporairement indisponible.'
      : 'The transit service is temporarily unavailable.',
  }
}

export const resolveTransitPlaces = createServerFn({ method: 'GET' })
  .validator((data: { query: string; locale: TransitLocale }) => data)
  .handler(async ({ data }): Promise<ServiceResult<Awaited<ReturnType<ReturnType<typeof client>['resolvePlaces']>>>> => {
    try {
      return { ok: true, data: await client().resolvePlaces(data.query, data.locale) }
    } catch (error) {
      return { ok: false, ...serviceError(error, data.locale) }
    }
  })

export const searchTransitRoutes = createServerFn({ method: 'POST' })
  .validator((data: { network: NetworkId; origin: SearchOrigin; destination: PlaceSelection; locale: TransitLocale }) => data)
  .handler(async ({ data }): Promise<ServiceResult<Awaited<ReturnType<ReturnType<typeof client>['searchRoutes']>>>> => {
    try {
      return { ok: true, data: await client().searchRoutes(data) }
    } catch (error) {
      return { ok: false, ...serviceError(error, data.locale) }
    }
  })

export const listContributionTransitStops = createServerFn({ method: 'GET' })
  .validator((data: { network: ContributionNetwork }) => data)
  .handler(async ({ data }): Promise<ServiceResult<Awaited<ReturnType<ReturnType<typeof client>['listContributionStops']>>>> => {
    try {
      return { ok: true, data: await client().listContributionStops(data.network) }
    } catch (error) {
      return { ok: false, ...serviceError(error, 'fr') }
    }
  })
