import { assertCoordinates, type Coordinates, type JourneyGeometry } from './map';
import type { PlaceCandidate } from './place';
import type { NetworkId, TransitDirection, TransitStop } from './transit';

export interface ServedPlace {
  placeId: string;
  areaName: string;
  directionId: string;
  alightingStopId: string;
  verifiedAt: string;
}

export interface WalkSegment {
  distanceMeters: number;
  instructions: string[];
  coordinates: Coordinates[];
}

export interface TransitLeg {
  directionId: string;
  network: NetworkId;
  networkName: string;
  lineNumber: string;
  directionName: string;
  boardingStop: TransitStop;
  alightingStop: TransitStop;
  orderedStops: TransitStop[];
  displayedDestinationLabel: string;
  receiverQuestion: string;
  walkBefore?: WalkSegment;
}

export interface JourneyOption {
  id: string;
  origin: Coordinates | PlaceCandidate;
  searchedDestination: PlaceCandidate;
  servedAreaName: string;
  legs: TransitLeg[];
  finalWalk: WalkSegment;
  transferCount: number;
  totalWalkMeters: number;
  verifiedAt: string;
  geometry: JourneyGeometry;
}

export interface TransitNetwork {
  directions: TransitDirection[];
  servedPlaces: ServedPlace[];
  stops: TransitStop[];
}

export function validateServedPlace(value: unknown): ServedPlace {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Served place must be an object');
  }

  const servedPlace = value as Partial<ServedPlace>;
  for (const field of ['placeId', 'areaName', 'directionId', 'alightingStopId'] as const) {
    if (typeof servedPlace[field] !== 'string' || !servedPlace[field].trim()) {
      throw new TypeError(`${field} must be a non-empty string`);
    }
  }

  if (
    typeof servedPlace.verifiedAt !== 'string' ||
    !Number.isFinite(Date.parse(servedPlace.verifiedAt))
  ) {
    throw new TypeError('Served place must have a valid verification date');
  }

  return {
    placeId: servedPlace.placeId!.trim(),
    areaName: servedPlace.areaName!.trim(),
    directionId: servedPlace.directionId!.trim(),
    alightingStopId: servedPlace.alightingStopId!.trim(),
    verifiedAt: servedPlace.verifiedAt,
  };
}

export function validateWalkSegment(value: unknown): WalkSegment {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Walk segment must be an object');
  }

  const walk = value as Partial<WalkSegment>;
  if (typeof walk.distanceMeters !== 'number' || !Number.isFinite(walk.distanceMeters) || walk.distanceMeters < 0) {
    throw new TypeError('Walk distance must be a non-negative finite number');
  }
  if (!Array.isArray(walk.instructions) || walk.instructions.some((step) => typeof step !== 'string')) {
    throw new TypeError('Walk instructions must be a list of strings');
  }
  if (!Array.isArray(walk.coordinates) || walk.coordinates.length === 0) {
    throw new TypeError('Walk segment must contain coordinates');
  }

  return {
    distanceMeters: walk.distanceMeters,
    instructions: walk.instructions,
    coordinates: walk.coordinates.map((coordinate, index) =>
      assertCoordinates(coordinate, `walk.coordinates[${index}]`),
    ),
  };
}
