import type { JourneyOption } from '../../../packages/domain/src/journey';
import type { RouteSearchInput } from '../../../packages/domain/src/search';
import type { PlaceCandidate } from '../../../packages/domain/src/place';

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface PlaceResolution {
  kind: string;
  places: PlaceCandidate[];
}

interface SearchRouteHandlerDependencies {
  resolvePlaces(query: string, locale: 'fr' | 'en', signal?: AbortSignal): Promise<PlaceResolution>;
  searchRoutes(input: {
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
  origin:
    | { kind: 'coordinates'; coordinates: { lat: number; lon: number } }
    | { kind: 'place'; placeId: string };
  destination: { placeId: string; query?: string };
  locale: 'fr' | 'en';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validCoordinates(value: unknown): value is { lat: number; lon: number } {
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

function validateBody(value: unknown): ValidRequestBody | undefined {
  if (!isRecord(value) || !isRecord(value.origin) || !isRecord(value.destination)) return undefined;
  const locale = value.locale;
  if (locale !== 'fr' && locale !== 'en') return undefined;
  const placeId = value.destination.placeId;
  if (typeof placeId !== 'string' || !placeId.trim() || placeId.length > 200) return undefined;
  let origin: ValidRequestBody['origin'];
  if (value.origin.kind === 'coordinates' && validCoordinates(value.origin.coordinates)) {
    origin = { kind: 'coordinates', coordinates: value.origin.coordinates };
  } else if (
    value.origin.kind === 'place' &&
    typeof value.origin.placeId === 'string' &&
    value.origin.placeId.trim().length > 0 &&
    value.origin.placeId.length <= 200
  ) {
    origin = { kind: 'place', placeId: value.origin.placeId.trim() };
  } else {
    return undefined;
  }
  const query = typeof value.destination.query === 'string' ? value.destination.query.trim() : undefined;
  return {
    origin,
    destination: { placeId: placeId.trim(), ...(query ? { query } : {}) },
    locale,
  };
}

function json(body: unknown, status = 200, additionalHeaders?: Record<string, string>): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  for (const [name, value] of Object.entries(additionalHeaders ?? {})) headers.set(name, value);
  return new Response(JSON.stringify(body), { status, headers });
}

async function readBoundedBody(
  request: Request,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string | undefined> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader && /^\d+$/.test(contentLengthHeader.trim())) {
    if (Number(contentLengthHeader) > maxBytes) return undefined;
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancelOnAbort = () => {
    void reader.cancel(new Error('Request aborted')).catch(() => undefined);
  };
  signal.addEventListener('abort', cancelOnAbort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Error('Request aborted');
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error('Request aborted');
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener('abort', cancelOnAbort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function handleRequest(
  request: Request,
  dependencies: SearchRouteHandlerDependencies,
  signal: AbortSignal,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { allow: 'POST' });
  const bodyText = await readBoundedBody(request, dependencies.maxBodyBytes, signal);
  if (bodyText === undefined) return json({ error: 'Request body too large' }, 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const body = validateBody(parsed);
  if (!body) return json({ error: 'Invalid search request' }, 400);

  // Vercel overwrites x-forwarded-for to prevent spoofing; never trust client-controlled x-real-ip.
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientKey = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  const rateLimit = await dependencies.rateLimit.check(clientKey);
  if (!rateLimit.allowed) {
    return json(
      { error: 'Rate limit exceeded' },
      429,
      rateLimit.retryAfterSeconds ? { 'retry-after': String(rateLimit.retryAfterSeconds) } : undefined,
    );
  }

  const destinationResolution = await dependencies.resolvePlaces(
    body.destination.query ?? body.destination.placeId,
    body.locale,
    signal,
  );
  if (destinationResolution.kind === 'ambiguous') {
    return json({ kind: 'ambiguous', places: destinationResolution.places }, 200);
  }
  const destination = destinationResolution.places.find((place) => place.id === body.destination.placeId);
  if (!destination) return json({ kind: 'not_found', places: [] }, 404);

  let origin: RouteSearchInput['origin'];
  if (body.origin.kind === 'coordinates') {
    origin = body.origin;
  } else {
    const requestedOriginPlaceId = body.origin.placeId;
    const originResolution = await dependencies.resolvePlaces(requestedOriginPlaceId, body.locale, signal);
    if (originResolution.kind === 'ambiguous') {
      return json({ kind: 'ambiguous_origin', places: originResolution.places }, 200);
    }
    const resolvedOrigin = originResolution.places.find((place) => place.id === requestedOriginPlaceId);
    if (!resolvedOrigin) return json({ kind: 'origin_not_found' }, 404);
    origin = resolvedOrigin;
  }

  const routes = await dependencies.searchRoutes({ origin, destination, locale: body.locale, signal });
  return json({ kind: 'routes', places: [destination], routes }, 200);
}

export function createSearchRoutesHandler(dependencies: SearchRouteHandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    const controller = new AbortController();
    const timeoutMs = Math.min(10_000, dependencies.requestTimeoutMs);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutResponse = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        controller.abort(new Error('Request timeout'));
        resolve(json({ error: 'Request timeout' }, 504));
      }, timeoutMs);
    });
    const work = handleRequest(request, dependencies, controller.signal);
    try {
      return await Promise.race([work, timeoutResponse]);
    } catch {
      if (controller.signal.aborted) return json({ error: 'Request timeout' }, 504);
      return json({ error: 'Unable to complete route search' }, 500);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
}


