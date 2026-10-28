import type { JourneyOption } from '../../../packages/domain/src/journey';
import type { RouteSearchInput } from '../../../packages/domain/src/search';
import { distanceMeters } from '../../../packages/domain/src/search';
import type { Coordinates } from '../../../packages/domain/src/map';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import { jsonResponse, localeFromAcceptLanguage, readBoundedRequestBody } from './httpRequest';
import type { PublishedServedPlace, PublishedTransitNetworkSnapshot } from './neon';

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  unavailable?: true;
}

type PlaceSelection =
  | { source: 'catalogue'; id: string }
  | { source: 'geocoder'; coordinates: Coordinates; displayName: string };

type CoordinateOrigin = { kind: 'coordinates'; coordinates: Coordinates };
type SelectedOrigin =
  | CoordinateOrigin
  | { kind: 'catalogue'; id: string }
  | { kind: 'geocoder'; coordinates: Coordinates; displayName: string };

interface SearchRouteHandlerDependencies {
  resolvePlaces(query: string, locale: 'fr' | 'en', signal?: AbortSignal): Promise<{
    kind: string;
    places: PlaceCandidate[];
  }>;
  loadPublishedSnapshot(signal?: AbortSignal): Promise<PublishedTransitNetworkSnapshot>;
  searchRoutes(input: {
    network: PublishedTransitNetworkSnapshot;
    origin: RouteSearchInput['origin'];
    destination: PlaceCandidate;
    locale: 'fr' | 'en';
    signal?: AbortSignal;
  }): Promise<JourneyOption[]>;
  rateLimit: { check(key: string): Promise<RateLimitResult> };
  maxBodyBytes: number;
  requestTimeoutMs: number;
}

interface ValidRequestBody {
  origin: SelectedOrigin;
  destination: PlaceSelection;
  locale: 'fr' | 'en';
}

type RequestValidation =
  | { kind: 'valid'; body: ValidRequestBody }
  | { kind: 'invalid'; reason: 'request' | 'place_name'; locale?: 'fr' | 'en' };

type PlaceSelectionResult =
  | { kind: 'valid'; selection: PlaceSelection }
  | { kind: 'invalid' }
  | { kind: 'invalid_place_name' };

const DAKAR_METRO_GEOCODER_BOUNDS = {
  minLatitude: 14.55,
  maxLatitude: 14.9,
  minLongitude: -17.6,
  maxLongitude: -17.05,
} as const;

const MAX_GEOCODER_LABEL_CODE_POINTS = 120;
const MAX_GEOCODER_DESTINATION_DISTANCE_METERS = 1_200;
// Treat approximately 10-nanometre haversine distance differences as equal to absorb IEEE-754 noise.
const DISTANCE_TIE_TOLERANCE_METERS = 1e-8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validCoordinates(value: unknown): value is Coordinates {
  if (!isRecord(value)) return false;
  const { lat, lon } = value;
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    lon >= -180 &&
    lon <= 180
  );
}

function isInsideDakarMetropolitanGuard(coordinates: Coordinates): boolean {
  // This is a coarse abuse guard, not a claim about Dakar's true geographic limits or a security boundary.
  // It applies to geocoder selections only; published catalogue places are always resolved by ID.
  return (
    coordinates.lat >= DAKAR_METRO_GEOCODER_BOUNDS.minLatitude &&
    coordinates.lat <= DAKAR_METRO_GEOCODER_BOUNDS.maxLatitude &&
    coordinates.lon >= DAKAR_METRO_GEOCODER_BOUNDS.minLongitude &&
    coordinates.lon <= DAKAR_METRO_GEOCODER_BOUNDS.maxLongitude
  );
}

function normalizeGeocoderLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.normalize('NFC');
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(normalized)) return undefined;
  const trimmed = normalized.trim();
  if (!trimmed || Array.from(trimmed).length > MAX_GEOCODER_LABEL_CODE_POINTS) return undefined;
  return trimmed;
}

function parsePlaceSelection(value: unknown): PlaceSelectionResult {
  if (!isRecord(value)) return { kind: 'invalid' };

  if (value.source === 'catalogue') {
    const id = value.id;
    if (typeof id !== 'string' || !id.trim() || id.trim().length > 200) return { kind: 'invalid' };
    return { kind: 'valid', selection: { source: 'catalogue', id: id.trim() } };
  }

  if (value.source !== 'geocoder' || !validCoordinates(value.coordinates)) return { kind: 'invalid' };
  const displayName = normalizeGeocoderLabel(value.displayName);
  if (!displayName) return { kind: 'invalid_place_name' };
  if (!isInsideDakarMetropolitanGuard(value.coordinates)) return { kind: 'invalid' };
  return {
    kind: 'valid',
    selection: { source: 'geocoder', coordinates: value.coordinates, displayName },
  };
}

function validateBody(value: unknown): RequestValidation {
  if (!isRecord(value) || !isRecord(value.origin)) return { kind: 'invalid', reason: 'request' };
  const locale = value.locale;
  if (locale !== 'fr' && locale !== 'en') return { kind: 'invalid', reason: 'request' };

  let origin: SelectedOrigin;
  if (value.origin.kind === 'coordinates') {
    if (!validCoordinates(value.origin.coordinates)) return { kind: 'invalid', reason: 'request' };
    origin = { kind: 'coordinates', coordinates: value.origin.coordinates };
  } else {
    const selectedOrigin = parsePlaceSelection(value.origin);
    if (selectedOrigin.kind === 'invalid_place_name') {
      return { kind: 'invalid', reason: 'place_name', locale };
    }
    if (selectedOrigin.kind === 'invalid') return { kind: 'invalid', reason: 'request' };
    origin = selectedOrigin.selection.source === 'catalogue'
      ? { kind: 'catalogue', id: selectedOrigin.selection.id }
      : {
          kind: 'geocoder',
          coordinates: selectedOrigin.selection.coordinates,
          displayName: selectedOrigin.selection.displayName,
        };
  }

  const selectedDestination = parsePlaceSelection(value.destination);
  if (selectedDestination.kind === 'invalid_place_name') {
    return { kind: 'invalid', reason: 'place_name', locale };
  }
  if (selectedDestination.kind === 'invalid') return { kind: 'invalid', reason: 'request' };

  return {
    kind: 'valid',
    body: { origin, destination: selectedDestination.selection, locale },
  };
}

function toCandidate(place: PublishedServedPlace): PublishedServedPlace {
  return place;
}

function closestPublishedPlace(
  coordinates: Coordinates,
  places: readonly PublishedServedPlace[],
): PublishedServedPlace | undefined {
  const eligiblePlaces = places
    .map((place) => ({ place, distance: distanceMeters(coordinates, place.coordinates) }))
    // Keep the documented service radius exact; no boundary epsilon admits an out-of-range place.
    .filter(({ distance }) => distance <= MAX_GEOCODER_DESTINATION_DISTANCE_METERS);
  if (eligiblePlaces.length === 0) return undefined;

  const closestDistance = Math.min(...eligiblePlaces.map(({ distance }) => distance));
  return eligiblePlaces
    .filter(({ distance }) => distance - closestDistance <= DISTANCE_TIE_TOLERANCE_METERS)
    .reduce<PublishedServedPlace | undefined>(
      (closest, { place }) => !closest || place.id < closest.id ? place : closest,
      undefined,
    );
}

function resolvePublishedSelection(
  selection: PlaceSelection,
  snapshot: PublishedTransitNetworkSnapshot,
): PlaceCandidate | undefined {
  if (selection.source === 'catalogue') {
    return snapshot.servedPlaces.find((place) => place.id === selection.id);
  }

  const nearest = closestPublishedPlace(selection.coordinates, snapshot.servedPlaces);
  if (!nearest) return undefined;
  return {
    id: nearest.id,
    displayName: selection.displayName,
    areaName: nearest.areaName,
    coordinates: selection.coordinates,
    source: 'geocoder',
  };
}

function localizedServiceUnavailable(locale: 'fr' | 'en'): Response {
  return jsonResponse({
    error: 'service_unavailable',
    message: locale === 'fr'
      ? 'La recherche d’itinéraire est temporairement indisponible.'
      : 'Route search is temporarily unavailable.',
  }, 503);
}

function localizedInternalError(locale: 'fr' | 'en'): Response {
  return jsonResponse({
    error: 'internal_error',
    message: locale === 'fr'
      ? 'La recherche d’itinéraire a échoué. Veuillez réessayer.'
      : 'Route search failed. Please try again.',
  }, 500);
}

async function handleRequest(
  request: Request,
  dependencies: SearchRouteHandlerDependencies,
  signal: AbortSignal,
  setLocale: (locale: 'fr' | 'en') => void,
): Promise<Response> {
  let locale = localeFromAcceptLanguage(request);
  setLocale(locale);
  if (request.method !== 'POST') {
    return jsonResponse({
      error: 'method_not_allowed',
      message: locale === 'fr' ? 'Méthode non autorisée.' : 'Method not allowed.',
    }, 405, { allow: 'POST' });
  }
  const bodyText = await readBoundedRequestBody(request, dependencies.maxBodyBytes, signal);
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
  const validation = validateBody(parsed);
  if (validation.kind === 'invalid') {
    locale = validation.locale ?? (
      isRecord(parsed) && (parsed.locale === 'en' || parsed.locale === 'fr') ? parsed.locale : locale
    );
    setLocale(locale);
    if (validation.reason === 'place_name') {
      return jsonResponse({
        error: 'invalid_place_name',
        message: locale === 'fr' ? 'Nom de lieu invalide.' : 'Invalid place name.',
      }, 400);
    }
    return jsonResponse({
      error: 'invalid_request',
      message: locale === 'fr' ? 'Requête invalide.' : 'Invalid request.',
    }, 400);
  }
  const body = validation.body;
  setLocale(body.locale);

  // Vercel overwrites x-forwarded-for to prevent spoofing; never trust client-controlled x-real-ip.
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientKey = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  const rateLimit = await dependencies.rateLimit.check(clientKey);
  if (rateLimit.unavailable) return localizedServiceUnavailable(body.locale);
  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        error: 'rate_limited',
        message: body.locale === 'fr'
          ? 'Trop de requêtes. Veuillez réessayer plus tard.'
          : 'Too many requests. Please try again later.',
      },
      429,
      rateLimit.retryAfterSeconds ? { 'retry-after': String(rateLimit.retryAfterSeconds) } : undefined,
    );
  }

  const snapshot = await dependencies.loadPublishedSnapshot(signal);

  let origin: RouteSearchInput['origin'];
  if (body.origin.kind === 'coordinates') {
    origin = body.origin;
  } else if (body.origin.kind === 'catalogue') {
    const selectedOriginId = body.origin.id;
    const publishedOrigin = snapshot.servedPlaces.find((place) => place.id === selectedOriginId);
    if (!publishedOrigin) return jsonResponse({ kind: 'origin_not_found' }, 404);
    origin = toCandidate(publishedOrigin);
  } else {
    origin = { kind: 'coordinates', coordinates: body.origin.coordinates };
  }

  const destination = resolvePublishedSelection(body.destination, snapshot);
  if (!destination) {
    if (body.destination.source === 'geocoder') {
      return jsonResponse({ kind: 'no_verified_journey' }, 200);
    }
    return jsonResponse({ kind: 'not_found', places: [] }, 404);
  }

  const routes = await dependencies.searchRoutes({
    network: snapshot,
    origin,
    destination,
    locale: body.locale,
    signal,
  });
  if (routes.length === 0) return jsonResponse({ kind: 'no_verified_journey' }, 200);
  return jsonResponse({ kind: 'routes', places: [destination], routes }, 200);
}

export function createSearchRoutesHandler(dependencies: SearchRouteHandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    const controller = new AbortController();
    let locale: 'fr' | 'en' = localeFromAcceptLanguage(request);
    const timeoutMs = Math.min(10_000, dependencies.requestTimeoutMs);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutResponse = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        controller.abort(new Error('Request timeout'));
        resolve(jsonResponse({
          error: 'request_timeout',
          message: locale === 'fr' ? 'La recherche a expiré.' : 'The search timed out.',
        }, 504));
      }, timeoutMs);
    });
    const work = handleRequest(request, dependencies, controller.signal, (validatedLocale) => {
      locale = validatedLocale;
    });
    try {
      return await Promise.race([work, timeoutResponse]);
    } catch {
      if (controller.signal.aborted) {
        return jsonResponse({
          error: 'request_timeout',
          message: locale === 'fr' ? 'La recherche a expiré.' : 'The search timed out.',
        }, 504);
      }
      return localizedInternalError(locale);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
}


