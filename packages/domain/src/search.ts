import type { JourneyOption, ServedPlace, TransitNetwork, TransitLeg, WalkSegment } from './journey';
import type { PlaceCandidate } from './place';
import type { Coordinates, JourneyGeometry, JourneySegment } from './map';
import type { NetworkId, TransitDirection, TransitStop } from './transit';

export interface RouteSearchInput {
  network: NetworkId;
  origin: { kind: 'coordinates'; coordinates: Coordinates } | PlaceCandidate;
  destination: PlaceCandidate;
  locale: 'fr' | 'en';
}

export interface SearchLimits {
  maxTransfers: number;
  maxOriginWalkMeters: number;
  maxDestinationWalkMeters: number;
  maxResults: number;
}

interface RouteState {
  direction: TransitDirection;
  startIndex: number;
  completedLegs: TransitLeg[];
  usedDirectionIds: Set<string>;
  transferCount: number;
  pendingTransfer?: WalkSegment;
}

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_TRANSFER_WALK_METERS = 200;

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lon - a.lon);
  const latitudeA = toRadians(a.lat);
  const latitudeB = toRadians(b.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function coordinatesOfOrigin(origin: RouteSearchInput['origin']): Coordinates {
  return 'kind' in origin ? origin.coordinates : origin.coordinates;
}

function makeWalk(from: Coordinates, to: Coordinates, locale: 'fr' | 'en'): WalkSegment {
  return {
    distanceMeters: distanceMeters(from, to),
    instructions: [locale === 'fr' ? 'Continuer à pied' : 'Continue on foot'],
    coordinates: [from, to],
  };
}

function makeLeg(
  direction: TransitDirection,
  startIndex: number,
  endIndex: number,
  pendingTransfer?: WalkSegment,
): TransitLeg {
  const orderedStops = direction.stops.slice(startIndex, endIndex + 1);
  return {
    directionId: direction.id,
    network: direction.network,
    networkName: direction.networkName,
    lineNumber: direction.lineNumber,
    directionName: direction.directionName,
    boardingStop: orderedStops[0],
    alightingStop: orderedStops[orderedStops.length - 1],
    orderedStops,
    displayedDestinationLabel: direction.displayedDestinationLabel,
    receiverQuestion: direction.receiverQuestion,
    ...(pendingTransfer ? { walkBefore: pendingTransfer } : {}),
  };
}

function geometryFor(
  origin: Coordinates,
  legs: TransitLeg[],
  originWalk: WalkSegment,
  finalWalk: WalkSegment,
): JourneyGeometry {
  const segments: JourneySegment[] = [];
  if (originWalk.coordinates.length > 0) {
    segments.push({ kind: 'walk', coordinates: originWalk.coordinates });
  }
  for (const leg of legs) {
    if (leg.walkBefore && leg.walkBefore.coordinates.length > 0) {
      segments.push({ kind: 'walk', coordinates: leg.walkBefore.coordinates });
    }
    segments.push({
      kind: 'tata',
      lineNumber: leg.lineNumber,
      network: leg.network,
      coordinates: leg.orderedStops.map((stop) => stop.coordinates),
    });
  }
  if (finalWalk.coordinates.length > 0) {
    segments.push({ kind: 'walk', coordinates: finalWalk.coordinates });
  }
  const points = segments.flatMap((segment) => segment.coordinates);
  if (points.length === 0) points.push(origin);
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

function buildJourney(
  input: RouteSearchInput,
  originCoordinates: Coordinates,
  servedPlace: ServedPlace,
  legs: TransitLeg[],
  transferCount: number,
  originWalk: WalkSegment,
  finalWalk: WalkSegment,
): JourneyOption {
  const totalWalkMeters =
    originWalk.distanceMeters +
    finalWalk.distanceMeters +
    legs.reduce((sum, leg) => sum + (leg.walkBefore?.distanceMeters ?? 0), 0);
  return {
    id: legs.map((leg) => leg.directionId + ':' + leg.boardingStop.id + '-' + leg.alightingStop.id).join('|'),
    origin: 'kind' in input.origin ? input.origin.coordinates : input.origin,
    searchedDestination: input.destination,
    servedAreaName: servedPlace.areaName,
    legs,
    finalWalk,
    transferCount,
    totalWalkMeters,
    verifiedAt: servedPlace.verifiedAt,
    geometry: geometryFor(originCoordinates, legs, originWalk, finalWalk),
  };
}

/** Finds journeys that serve the exact resolved destination candidate. */
export function findJourneys(
  network: TransitNetwork,
  input: RouteSearchInput,
  limits: SearchLimits,
): JourneyOption[] {
  const originCoordinates = coordinatesOfOrigin(input.origin);
  const options: JourneyOption[] = [];
  const routableDirections = network.directions.filter((direction) =>
    direction.network === input.network &&
    direction.qualityStatus === 'confirmed' &&
    direction.stops.every((stop) =>
      stop.network === input.network && stop.qualityStatus === 'confirmed'
    ),
  );

  const explore = (state: RouteState): void => {
    const currentStops = state.direction.stops;
    for (const servedPlace of network.servedPlaces) {
      if (servedPlace.placeId !== input.destination.id || servedPlace.directionId !== state.direction.id) continue;
      const alightingIndex = currentStops.findIndex((stop) => stop.id === servedPlace.alightingStopId);
      if (alightingIndex <= state.startIndex) continue;
      const lastStop = currentStops[alightingIndex];
      const finalWalk = makeWalk(lastStop.coordinates, input.destination.coordinates, input.locale);
      if (finalWalk.distanceMeters > limits.maxDestinationWalkMeters) continue;
      const legs = [
        ...state.completedLegs,
        makeLeg(state.direction, state.startIndex, alightingIndex, state.pendingTransfer),
      ];
      const originWalk = makeWalk(originCoordinates, legs[0].boardingStop.coordinates, input.locale);
      options.push(buildJourney(input, originCoordinates, servedPlace, legs, state.transferCount, originWalk, finalWalk));
    }

    if (state.transferCount >= limits.maxTransfers) return;
    for (let exitIndex = state.startIndex + 1; exitIndex < currentStops.length; exitIndex += 1) {
      const exitStop = currentStops[exitIndex];
      for (const nextDirection of routableDirections) {
        if (state.usedDirectionIds.has(nextDirection.id)) continue;
        for (let nextStartIndex = 0; nextStartIndex < nextDirection.stops.length - 1; nextStartIndex += 1) {
          const nextBoarding = nextDirection.stops[nextStartIndex];
          const transferWalk = makeWalk(exitStop.coordinates, nextBoarding.coordinates, input.locale);
          if (transferWalk.distanceMeters > MAX_TRANSFER_WALK_METERS) continue;
          const completedLegs = [
            ...state.completedLegs,
            makeLeg(state.direction, state.startIndex, exitIndex, state.pendingTransfer),
          ];
          explore({
            direction: nextDirection,
            startIndex: nextStartIndex,
            completedLegs,
            usedDirectionIds: new Set([...state.usedDirectionIds, nextDirection.id]),
            transferCount: state.transferCount + 1,
            pendingTransfer: transferWalk,
          });
        }
      }
    }
  };

  for (const direction of routableDirections) {
    for (let startIndex = 0; startIndex < direction.stops.length - 1; startIndex += 1) {
      const originWalk = makeWalk(originCoordinates, direction.stops[startIndex].coordinates, input.locale);
      if (originWalk.distanceMeters > limits.maxOriginWalkMeters) continue;
      explore({
        direction,
        startIndex,
        completedLegs: [],
        usedDirectionIds: new Set([direction.id]),
        transferCount: 0,
      });
    }
  }

  const unique = new Map(options.map((option) => [option.id, option]));
  return [...unique.values()]
    .sort((a, b) =>
      a.transferCount - b.transferCount ||
      a.totalWalkMeters - b.totalWalkMeters ||
      a.legs.reduce((sum, leg) => sum + leg.orderedStops.length, 0) -
        b.legs.reduce((sum, leg) => sum + leg.orderedStops.length, 0),
    )
    .slice(0, limits.maxResults);
}
