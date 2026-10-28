import { findJourneys, type RouteSearchInput, type SearchLimits } from '../../../packages/domain/src/search';
import type { JourneyGeometry, JourneySegment } from '../../../packages/domain/src/map';
import type { JourneyOption, TransitNetwork, WalkSegment } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';

export interface WalkingRouteRequest {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  locale: 'fr' | 'en';
  signal?: AbortSignal;
}

export interface WalkingRouteProvider {
  route(request: WalkingRouteRequest): Promise<WalkSegment>;
}

const DEFAULT_LIMITS: SearchLimits = {
  maxTransfers: 2,
  maxOriginWalkMeters: 800,
  maxDestinationWalkMeters: 1200,
  maxResults: 3,
};

const WALK_TIMEOUT_MS = 4_000;

async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
  parentSignal?: AbortSignal,
): Promise<T> {
  if (parentSignal?.aborted) throw new Error('Request aborted');
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(new Error('Request aborted'));
  parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error(`${label} timeout after ${timeoutMs} ms`)),
    timeoutMs,
  );
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => {
      const reason = controller.signal.reason;
      reject(reason instanceof Error ? reason : new Error(`${label} aborted`));
    }, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(() => task(controller.signal)), aborted]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}

function coordinatesOfOrigin(origin: RouteSearchInput['origin']): { lat: number; lon: number } {
  return origin.coordinates;
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

export async function searchRoutes(options: {
  network: TransitNetwork;
  origin: RouteSearchInput['origin'];
  destination: PlaceCandidate;
  locale: 'fr' | 'en';
  walking: WalkingRouteProvider;
  limits?: SearchLimits;
  signal?: AbortSignal;
}): Promise<JourneyOption[]> {
  const requestedLimits = options.limits ?? DEFAULT_LIMITS;
  const input: RouteSearchInput = {
    origin: options.origin,
    destination: options.destination,
    locale: options.locale,
  };
  // Route every feasible candidate before applying maxResults, because real pedestrian distances can change ranking.
  const candidates = findJourneys(options.network, input, {
    ...requestedLimits,
    maxResults: Number.MAX_SAFE_INTEGER,
  });
  const routed: JourneyOption[] = [];

  for (const candidate of candidates) {
    const firstLeg = candidate.legs[0];
    const lastLeg = candidate.legs[candidate.legs.length - 1];
    const start = coordinatesOfOrigin(input.origin);
    const originWalk = await withTimeout(
      (signal) => options.walking.route({ from: start, to: firstLeg.boardingStop.coordinates, locale: options.locale, signal }),
      WALK_TIMEOUT_MS,
      'Walking route',
      options.signal,
    );
    if (originWalk.distanceMeters > requestedLimits.maxOriginWalkMeters) continue;

    const legs = candidate.legs.map((leg) => ({ ...leg }));
    let transferTooLong = false;
    for (let index = 1; index < legs.length; index += 1) {
      const previous = legs[index - 1];
      const current = legs[index];
      const walkBefore = await withTimeout(
        (signal) => options.walking.route({
          from: previous.alightingStop.coordinates,
          to: current.boardingStop.coordinates,
          locale: options.locale,
          signal,
        }),
        WALK_TIMEOUT_MS,
        'Walking route',
        options.signal,
      );
      if (walkBefore.distanceMeters > 200) {
        transferTooLong = true;
        break;
      }
      current.walkBefore = walkBefore;
    }
    if (transferTooLong) continue;

    const finalWalk = await withTimeout(
      (signal) => options.walking.route({
        from: lastLeg.alightingStop.coordinates,
        to: options.destination.coordinates,
        locale: options.locale,
        signal,
      }),
      WALK_TIMEOUT_MS,
      'Walking route',
      options.signal,
    );
    if (finalWalk.distanceMeters > requestedLimits.maxDestinationWalkMeters) continue;

    const totalWalkMeters =
      originWalk.distanceMeters +
      finalWalk.distanceMeters +
      legs.reduce((total, leg) => total + (leg.walkBefore?.distanceMeters ?? 0), 0);
    routed.push({
      ...candidate,
      legs,
      finalWalk,
      totalWalkMeters,
      geometry: geometryForRoutedJourney(originWalk, legs, finalWalk),
    });
  }

  return routed
    .sort((a, b) =>
      a.transferCount - b.transferCount ||
      a.totalWalkMeters - b.totalWalkMeters ||
      a.legs.reduce((sum, leg) => sum + leg.orderedStops.length, 0) -
        b.legs.reduce((sum, leg) => sum + leg.orderedStops.length, 0),
    )
    .slice(0, requestedLimits.maxResults);
}
