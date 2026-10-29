import type { PlaceCandidate } from '../../../packages/domain/src/place';
import { createPublishedNetworkReader } from '../src/neon';
import type { PublishedTransitNetworkSnapshot } from '../src/neon';
import { jsonResponse, localeFromAcceptLanguage, readBoundedRequestBody } from '../src/httpRequest';
import { createCachedNetworkLoader } from '../src/networkCache';
import { createRateLimitPolicy } from '../src/rateLimitPolicy';
import type { SharedRateLimitStore } from '../src/rateLimit';
import { createPlaceResolver, createStadiaGeocoder } from '../src/places';

type EndpointEnvironment = Readonly<Record<string, string | undefined>>;
type ResolvePlaces = (
  query: string,
  locale: 'fr' | 'en',
  signal?: AbortSignal,
) => Promise<{ kind: string; places: PlaceCandidate[] }>;

interface ResolvePlacesEndpointOptions {
  env: EndpointEnvironment;
  sharedRateLimitStore?: SharedRateLimitStore;
  stadiaApiKey?: string;
  resolvePlaces?: ResolvePlaces;
  requestTimeoutMs?: number;
}

function localizedUnavailable(locale: 'fr' | 'en'): Response {
  return jsonResponse({
    error: 'service_unavailable',
    message: locale === 'fr'
      ? 'La recherche de lieux est temporairement indisponible.'
      : 'Place search is temporarily unavailable.',
  }, 503);
}

function localizedFailure(locale: 'fr' | 'en'): Response {
  return jsonResponse({
    error: 'internal_error',
    message: locale === 'fr'
      ? 'La recherche de lieux a échoué. Veuillez réessayer.'
      : 'Place search failed. Please try again.',
  }, 500);
}

function localizedTimeout(locale: 'fr' | 'en'): Response {
  return jsonResponse({
    error: 'request_timeout',
    message: locale === 'fr' ? 'La recherche a expiré.' : 'The search timed out.',
    partial: true,
    partialReason: 'deadline',
  }, 504);
}

type RuntimeNetworkReader = Pick<ReturnType<typeof createPublishedNetworkReader>, 'load'>;

interface RuntimeNetworkOptions {
  createReader?: (options: { connectionString: string }) => RuntimeNetworkReader;
  now?: () => number;
}

export function createRuntimeResolver(
  env: EndpointEnvironment,
  options: RuntimeNetworkOptions = {},
): ResolvePlaces {
  let resolver: ReturnType<typeof createPlaceResolver> | undefined;

  return async (query, locale, signal) => {
    const apiKey = env.STADIA_ROUTING_API_KEY;
    const connectionString = env.DATABASE_URL_PUBLIC_API;
    if (!apiKey || !connectionString) throw new Error('Place search dependencies are unavailable');

    if (!resolver) {
      const reader = (options.createReader ?? createPublishedNetworkReader)({ connectionString });
      const loadSnapshot = createCachedNetworkLoader({
        load: (requestSignal) => reader.load({ signal: requestSignal }),
        now: options.now,
      });
      resolver = createPlaceResolver({
        catalogue: {
          async search(rawQuery, searchLocale, searchSignal) {
            const network = await loadSnapshot(searchSignal);
            const needle = rawQuery.normalize('NFC').trim().toLocaleLowerCase(searchLocale);
            return network.servedPlaces.filter((place) =>
              [place.displayName, ...place.aliases].some((label) =>
                label.normalize('NFC').trim().toLocaleLowerCase(searchLocale) === needle,
              ),
            );
          },
        },
        geocoder: createStadiaGeocoder({ apiKey, fetch }),
      });
    }

    return resolver(query, locale, signal);
  };
}

export function createResolvePlacesEndpoint(options: ResolvePlacesEndpointOptions) {
  const policy = createRateLimitPolicy({
    vercelEnv: options.env.VERCEL_ENV,
    allowMemoryRateLimit: options.env.ALLOW_MEMORY_RATE_LIMIT,
    sharedStore: options.sharedRateLimitStore,
    namespace: 'resolve-places',
    configuredMaxRequests: options.env.RATE_LIMIT_RESOLVE_PLACES_PER_MINUTE,
    defaultMaxRequests: 60,
  });

  const handleRequest = async (request: Request, signal: AbortSignal): Promise<Response> => {
    let locale = localeFromAcceptLanguage(request);
    if (request.method !== 'POST') {
      return jsonResponse({
        error: 'method_not_allowed',
        message: locale === 'fr' ? 'Méthode non autorisée.' : 'Method not allowed.',
      }, 405, { allow: 'POST' });
    }

    let bodyText: string | undefined;
    try {
      bodyText = await readBoundedRequestBody(request, 16_384, signal);
    } catch {
      if (signal.aborted) return localizedTimeout(locale);
      return jsonResponse({
        error: 'invalid_request',
        message: locale === 'fr' ? 'Requête JSON invalide.' : 'Invalid request.',
      }, 400);
    }
    if (bodyText === undefined) {
      return jsonResponse({
        error: 'request_too_large',
        message: locale === 'fr' ? 'La requête est trop volumineuse.' : 'Request body is too large.',
      }, 413);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return jsonResponse({
        error: 'invalid_json',
        message: locale === 'fr' ? 'Requête JSON invalide.' : 'Invalid request.',
      }, 400);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return jsonResponse({
        error: 'invalid_request',
        message: locale === 'fr' ? 'Requête invalide.' : 'Invalid request.',
      }, 400);
    }

    const body = parsed as Record<string, unknown>;
    locale = body.locale === 'en' || body.locale === 'fr' ? body.locale : locale;
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query || query.length > 200 || (body.locale !== 'fr' && body.locale !== 'en')) {
      return jsonResponse({
        error: 'invalid_request',
        message: locale === 'fr' ? 'Recherche de lieu invalide.' : 'Invalid place search.',
      }, 400);
    }

    if (!policy.rateLimit) return localizedUnavailable(locale);

    try {
      const forwardedFor = request.headers.get('x-forwarded-for');
      const clientKey = forwardedFor?.split(',')[0]?.trim() || 'unknown';
      const rateLimit = await policy.rateLimit.check(clientKey, { signal });
      if (rateLimit.unavailable) return localizedUnavailable(locale);
      if (!rateLimit.allowed) {
        return jsonResponse({
          error: 'rate_limited',
          message: locale === 'fr'
            ? 'Trop de requêtes. Veuillez réessayer plus tard.'
            : 'Too many requests. Please try again later.',
        }, 429, rateLimit.retryAfterSeconds
          ? { 'retry-after': String(rateLimit.retryAfterSeconds) }
          : undefined);
      }

      if (!options.stadiaApiKey?.trim() || !options.resolvePlaces) return localizedUnavailable(locale);

      const result = await options.resolvePlaces(query, locale, signal);
      return jsonResponse(result);
    } catch {
      if (signal.aborted) return localizedTimeout(locale);
      return localizedFailure(locale);
    }
  };

  return async (request: Request): Promise<Response> => {
    const controller = new AbortController();
    const abortFromRequest = () => controller.abort(new Error('Request aborted'));
    if (request.signal.aborted) abortFromRequest();
    else request.signal.addEventListener('abort', abortFromRequest, { once: true });

    const locale = localeFromAcceptLanguage(request);
    const timeoutMs = Math.min(10_000, options.requestTimeoutMs ?? 10_000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutResponse = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        controller.abort(new Error('Request timeout'));
        resolve(localizedTimeout(locale));
      }, timeoutMs);
    });

    try {
      return await Promise.race([handleRequest(request, controller.signal), timeoutResponse]);
    } catch {
      return controller.signal.aborted ? localizedTimeout(locale) : localizedFailure(locale);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      request.signal.removeEventListener('abort', abortFromRequest);
    }
  };
}

const runtimeEnv = process.env;
const runtimeEndpoint = createResolvePlacesEndpoint({
  env: runtimeEnv,
  stadiaApiKey: runtimeEnv.STADIA_ROUTING_API_KEY,
  resolvePlaces: createRuntimeResolver(runtimeEnv),
});

export default {
  fetch(request: Request): Promise<Response> {
    return runtimeEndpoint(request);
  },
};
