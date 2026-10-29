import { findJourneys, type RouteSearchInput, type SearchLimits } from '../../../packages/domain/src/search';
import type { JourneyGeometry, JourneySegment } from '../../../packages/domain/src/map';
import type { JourneyOption, TransitNetwork, WalkSegment } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import { withAbortTimeout } from './abort';

export interface WalkingRouteRequest {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  locale: 'fr' | 'en';
  signal?: AbortSignal;
}

export interface WalkingRouteProvider {
  route(request: WalkingRouteRequest): Promise<WalkSegment>;
}

export const MAX_WALKING_CALLS_PER_REQUEST = 12;
const MAX_CONCURRENT_WALKING_CALLS = 3;
const WALK_TIMEOUT_MS = 4_000;

const DEFAULT_LIMITS: SearchLimits = {
  maxTransfers: 2,
  maxOriginWalkMeters: 800,
  maxDestinationWalkMeters: 1200,
  maxResults: 3,
};

export function maxWalkingCallsPerRequestFromEnvironment(value = process.env.MAX_WALKING_CALLS_PER_REQUEST): number {
  if (value === undefined || value.trim() === '') return MAX_WALKING_CALLS_PER_REQUEST;
  if (!/^\s*[1-9]\d*\s*$/.test(value)) {
    throw new TypeError('MAX_WALKING_CALLS_PER_REQUEST must be a positive integer');
  }
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed > MAX_WALKING_CALLS_PER_REQUEST) {
    throw new TypeError('MAX_WALKING_CALLS_PER_REQUEST must not exceed the supported maximum');
  }
  return parsed;
}

function walkingCallLimit(explicitLimit?: number): number {
  if (explicitLimit !== undefined) {
    if (!Number.isSafeInteger(explicitLimit) || explicitLimit < 0) {
      throw new TypeError('maxExternalCallsPerRequest must be a non-negative safe integer');
    }
    return Math.min(explicitLimit, MAX_WALKING_CALLS_PER_REQUEST);
  }
  return maxWalkingCallsPerRequestFromEnvironment();
}

export type PartialSearchReason = 'call_limit' | 'deadline' | 'walking_service_error';

export interface RoutingSearchResult {
  routes: JourneyOption[];
  partial: boolean;
  partialReason?: PartialSearchReason;
}

interface WalkingSegmentPlan {
  key: string;
  from: WalkingRouteRequest['from'];
  to: WalkingRouteRequest['to'];
}

interface CandidatePlan {
  candidate: JourneyOption;
  rank: number;
  estimatedWalkMeters: number;
  segments: WalkingSegmentPlan[];
}

function coordinatesOfOrigin(origin: RouteSearchInput['origin']): { lat: number; lon: number } {
  return origin.coordinates;
}

function compareCodePointLexically(left: string, right: string): number {
  const leftCodePoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightCodePoints = Array.from(right, (character) => character.codePointAt(0)!);
  const sharedLength = Math.min(leftCodePoints.length, rightCodePoints.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftCodePoints[index] - rightCodePoints[index];
    if (difference !== 0) return difference;
  }

  return leftCodePoints.length - rightCodePoints.length;
}

function decodePolyline6(encoded: string): Array<{ lat: number; lon: number }> {
  const coordinates: Array<{ lat: number; lon: number }> = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  const readDelta = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length || shift > 30) throw new Error('Invalid walking geometry');
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('Invalid walking geometry');
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return (result & 1) ? ~(result >> 1) : (result >> 1);
  };

  while (index < encoded.length) {
    latitude += readDelta();
    longitude += readDelta();
    const point = { lat: latitude / 1_000_000, lon: longitude / 1_000_000 };
    if (
      !Number.isFinite(point.lat) || !Number.isFinite(point.lon) ||
      point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180
    ) {
      throw new Error('Invalid walking geometry');
    }
    coordinates.push(point);
  }
  if (coordinates.length < 2) throw new Error('Invalid walking geometry');
  return coordinates;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function walkSegmentFromStadiaPayload(payload: unknown): WalkSegment {
  const trip = recordValue(recordValue(payload)?.trip);
  const summary = recordValue(trip?.summary);
  const lengthKilometers = summary?.length;
  const legs = trip?.legs;
  if (
    typeof lengthKilometers !== 'number' || !Number.isFinite(lengthKilometers) || lengthKilometers < 0 ||
    !Array.isArray(legs) || legs.length === 0
  ) {
    throw new Error('Stadia walking response is invalid');
  }

  const coordinates: Array<{ lat: number; lon: number }> = [];
  const instructions: string[] = [];
  for (const rawLeg of legs) {
    const leg = recordValue(rawLeg);
    if (typeof leg?.shape !== 'string') throw new Error('Stadia walking response is invalid');
    const legCoordinates = decodePolyline6(leg.shape);
    coordinates.push(...(coordinates.length > 0 ? legCoordinates.slice(1) : legCoordinates));
    if (Array.isArray(leg.maneuvers)) {
      for (const rawManeuver of leg.maneuvers) {
        const instruction = recordValue(rawManeuver)?.instruction;
        if (typeof instruction === 'string' && instruction.trim()) instructions.push(instruction.trim());
      }
    }
  }

  return {
    distanceMeters: lengthKilometers * 1_000,
    instructions,
    coordinates,
  };
}

/** Server-only Stadia walking adapter. Fetch is injected so tests never use the network. */
export function createStadiaWalkingProvider(options: {
  apiKey: string;
  fetch: typeof fetch;
  requestTimeoutMs?: number;
}): WalkingRouteProvider {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error('Stadia walking service is unavailable');
  const requestTimeoutMs = options.requestTimeoutMs ?? WALK_TIMEOUT_MS;

  return {
    async route(request: WalkingRouteRequest): Promise<WalkSegment> {
      try {
        const payload = await withAbortTimeout(async (signal) => {
          const response = await options.fetch('https://api.stadiamaps.com/route/v1', {
            method: 'POST',
            headers: {
              accept: 'application/json',
              authorization: `Stadia-Auth ${apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              locations: [
                { ...request.from, type: 'break' },
                { ...request.to, type: 'break' },
              ],
              costing: 'pedestrian',
              units: 'kilometers',
              language: request.locale === 'fr' ? 'fr-FR' : 'en-GB',
            }),
            signal,
          });
          if (!response.ok) throw new Error('Stadia walking request failed');
          return await response.json() as unknown;
        }, requestTimeoutMs, `Stadia walking timeout after ${requestTimeoutMs} ms`, request.signal);
        return walkSegmentFromStadiaPayload(payload);
      } catch (error) {
        if (error instanceof Error && /timeout/i.test(error.message)) throw error;
        throw new Error('Stadia walking request failed');
      }
    },
  };
}

function segmentKey(from: WalkingRouteRequest['from'], to: WalkingRouteRequest['to']): string {
  return `${from.lat},${from.lon}>${to.lat},${to.lon}`;
}

function localDistanceMeters(from: WalkingRouteRequest['from'], to: WalkingRouteRequest['to']): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lon - from.lon);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function geometryForRoutedJourney(
  originWalk: WalkSegment,
  legs: JourneyOption['legs'],
  finalWalk: WalkSegment,
): JourneyGeometry {
  const segments: JourneySegment[] = [];
  if (originWalk.coordinates.length > 0) segments.push({ kind: 'walk', coordinates: originWalk.coordinates });
  for (const leg of legs) {
    if (leg.walkBefore?.coordinates.length) {
      segments.push({ kind: 'walk', coordinates: leg.walkBefore.coordinates });
    }
    segments.push({
      kind: 'tata',
      lineNumber: leg.lineNumber,
      coordinates: leg.orderedStops.map((stop) => stop.coordinates),
    });
  }
  if (finalWalk.coordinates.length > 0) segments.push({ kind: 'walk', coordinates: finalWalk.coordinates });
  const points = segments.flatMap((segment) => segment.coordinates);
  const longitudes = points.map(({ lon }) => lon);
  const latitudes = points.map(({ lat }) => lat);
  return {
    segments,
    bounds: [
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes),
    ],
  };
}

function candidateSegments(
  candidate: JourneyOption,
  origin: RouteSearchInput['origin'],
  destination: PlaceCandidate,
): WalkingSegmentPlan[] {
  const segments: WalkingSegmentPlan[] = [];
  const add = (from: WalkingRouteRequest['from'], to: WalkingRouteRequest['to']) => {
    segments.push({ key: segmentKey(from, to), from, to });
  };
  const firstLeg = candidate.legs[0];
  const lastLeg = candidate.legs[candidate.legs.length - 1];
  const start = coordinatesOfOrigin(origin);
  add(start, firstLeg.boardingStop.coordinates);
  for (let index = 1; index < candidate.legs.length; index += 1) {
    add(candidate.legs[index - 1].alightingStop.coordinates, candidate.legs[index].boardingStop.coordinates);
  }
  add(lastLeg.alightingStop.coordinates, destination.coordinates);
  return segments;
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex]);
    }
  }));
}

function reasonPriority(reason: PartialSearchReason | undefined): number {
  switch (reason) {
    case 'deadline': return 3;
    case 'walking_service_error': return 2;
    case 'call_limit': return 1;
    default: return 0;
  }
}

function combineReason(
  current: PartialSearchReason | undefined,
  next: PartialSearchReason,
): PartialSearchReason {
  return reasonPriority(next) > reasonPriority(current) ? next : current ?? next;
}

/**
 * Routes each candidate with real pedestrian distances. Domain rank is preserved as the primary
 * prescreen order; straight-line distance is only a deterministic secondary prescreen estimate.
 * It is never returned as a walking route or presented as verified walking geometry.
 */
export async function searchRoutesWithMetadata(options: {
  network: TransitNetwork;
  origin: RouteSearchInput['origin'];
  destination: PlaceCandidate;
  locale: 'fr' | 'en';
  walking: WalkingRouteProvider;
  limits?: SearchLimits;
  signal?: AbortSignal;
  maxExternalCallsPerRequest?: number;
}): Promise<RoutingSearchResult> {
  const requestedLimits = options.limits ?? DEFAULT_LIMITS;
  const maxExternalCalls = walkingCallLimit(options.maxExternalCallsPerRequest);

  const input: RouteSearchInput = {
    origin: options.origin,
    destination: options.destination,
    locale: options.locale,
  };
  const candidates = findJourneys(options.network, input, {
    ...requestedLimits,
    maxResults: Number.MAX_SAFE_INTEGER,
  });
  if (candidates.length === 0) return { routes: [], partial: false };

  const candidatePlans = candidates.map((candidate, rank): CandidatePlan => {
    const segments = candidateSegments(candidate, input.origin, options.destination);
    return {
      candidate,
      rank,
      estimatedWalkMeters: segments.reduce(
        (total, segment) => total + localDistanceMeters(segment.from, segment.to),
        0,
      ),
      segments,
    };
  }).sort((left, right) =>
    left.rank - right.rank ||
    left.estimatedWalkMeters - right.estimatedWalkMeters ||
    compareCodePointLexically(
      left.candidate.legs.map(({ directionId }) => directionId).join('|'),
      right.candidate.legs.map(({ directionId }) => directionId).join('|'),
    ),
  );

  const acceptedCandidates: CandidatePlan[] = [];
  const uniqueSegments = new Map<string, WalkingSegmentPlan>();
  let hitCallLimit = false;
  for (const plan of candidatePlans) {
    const newSegments = plan.segments.filter((segment) => !uniqueSegments.has(segment.key));
    if (uniqueSegments.size + newSegments.length > maxExternalCalls) {
      hitCallLimit = true;
      continue;
    }
    acceptedCandidates.push(plan);
    for (const segment of newSegments) uniqueSegments.set(segment.key, segment);
  }

  const segmentResults = new Map<string, WalkSegment>();
  let partialReason: PartialSearchReason | undefined = hitCallLimit ? 'call_limit' : undefined;
  await mapWithConcurrency([...uniqueSegments.values()], MAX_CONCURRENT_WALKING_CALLS, async (segment) => {
    try {
      const result = await withAbortTimeout(
        (signal) => options.walking.route({
          from: segment.from,
          to: segment.to,
          locale: options.locale,
          signal,
        }),
        WALK_TIMEOUT_MS,
        `Walking route timeout after ${WALK_TIMEOUT_MS} ms`,
        options.signal,
      );
      segmentResults.set(segment.key, result);
    } catch (error) {
      const callTimedOut = error instanceof Error && /timeout/i.test(error.message);
      partialReason = combineReason(
        partialReason,
        options.signal?.aborted || callTimedOut ? 'deadline' : 'walking_service_error',
      );
    }
  });

  const routed: JourneyOption[] = [];
  for (const plan of acceptedCandidates) {
    const walks = plan.segments.map(({ key }) => segmentResults.get(key));
    if (walks.some((walk) => walk === undefined)) continue;
    const resolvedWalks = walks as WalkSegment[];
    const originWalk = resolvedWalks[0];
    if (originWalk.distanceMeters > requestedLimits.maxOriginWalkMeters) continue;

    const legs = plan.candidate.legs.map((leg) => ({ ...leg }));
    let transferTooLong = false;
    for (let index = 1; index < legs.length; index += 1) {
      const walkBefore = resolvedWalks[index];
      if (walkBefore.distanceMeters > 200) {
        transferTooLong = true;
        break;
      }
      legs[index].walkBefore = walkBefore;
    }
    if (transferTooLong) continue;

    const finalWalk = resolvedWalks[resolvedWalks.length - 1];
    if (finalWalk.distanceMeters > requestedLimits.maxDestinationWalkMeters) continue;

    const totalWalkMeters =
      originWalk.distanceMeters +
      finalWalk.distanceMeters +
      legs.reduce((total, leg) => total + (leg.walkBefore?.distanceMeters ?? 0), 0);
    routed.push({
      ...plan.candidate,
      legs,
      finalWalk,
      totalWalkMeters,
      geometry: geometryForRoutedJourney(originWalk, legs, finalWalk),
    });
  }

  const routes = routed
    .sort((left, right) =>
      left.transferCount - right.transferCount ||
      left.totalWalkMeters - right.totalWalkMeters ||
      left.legs.reduce((sum, leg) => sum + leg.orderedStops.length, 0) -
        right.legs.reduce((sum, leg) => sum + leg.orderedStops.length, 0) ||
      compareCodePointLexically(
        left.legs.map(({ directionId }) => directionId).join('|'),
        right.legs.map(({ directionId }) => directionId).join('|'),
      ),
    )
    .slice(0, requestedLimits.maxResults);

  return partialReason
    ? { routes, partial: true, partialReason }
    : { routes, partial: false };
}

/** Historical array-only API retained for existing callers. */
export async function searchRoutes(options: Parameters<typeof searchRoutesWithMetadata>[0]): Promise<JourneyOption[]> {
  const result = await searchRoutesWithMetadata(options);
  if (result.routes.length === 0 && result.partialReason) {
    if (result.partialReason === 'deadline') throw new Error('Walking route timeout exceeded');
    if (result.partialReason === 'call_limit') throw new Error('Walking route call limit prevented a complete result');
    throw new Error('Walking route provider failed');
  }
  return result.routes;
}
