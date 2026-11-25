import { assertCoordinates, type Coordinates } from './map';

export interface TransitStop {
  id: string;
  network: NetworkId;
  qualityStatus: 'confirmed';
  source: string;
  sourceReference: string;
  name: string;
  coordinates: Coordinates;
  aliases: string[];
}

/** Network IDs are stable source boundaries; unknown IDs remain forward-compatible. */
export type NetworkId = 'aftu_dakar' | 'tata_thies' | (string & {});

export type TransitQualityStatus = 'incomplete' | 'needs_verification' | 'confirmed';

/** A source record that may be incomplete and therefore cannot enter route search. */
export interface IncompleteTransitStop {
  id: string;
  network: NetworkId;
  qualityStatus: 'incomplete';
  source: string;
  sourceReference?: string;
  name?: string | null;
  coordinates?: never;
}

export interface UnverifiedTransitStop {
  id: string;
  network: NetworkId;
  qualityStatus: 'incomplete' | 'needs_verification';
  source: string;
  sourceReference?: string;
  name?: string | null;
  coordinates?: Coordinates | null;
  aliases?: string[];
}

export type TransitStopRecord = TransitStop | UnverifiedTransitStop;

export interface TransitDirection {
  id: string;
  network: NetworkId;
  networkName: string;
  qualityStatus: 'confirmed';
  source: string;
  lineNumber: string;
  directionName: string;
  displayedDestinationLabel: string;
  receiverQuestion: string;
  stops: TransitStop[];
}

function requiredText(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function validateStop(value: unknown, index: number, network: NetworkId): TransitStop {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`stops[${index}] must be an object`);
  }

  const stop = value as Partial<TransitStop>;
  if (stop.network !== network) {
    throw new TypeError(`stops[${index}] must belong to the same network as its direction`);
  }
  if (stop.qualityStatus !== 'confirmed') {
    throw new TypeError(`stops[${index}] must be confirmed before route search`);
  }
  if (!Array.isArray(stop.aliases) || stop.aliases.some((alias) => typeof alias !== 'string')) {
    throw new TypeError(`stops[${index}].aliases must be a list of strings`);
  }

  return {
    id: requiredText(stop.id, `stops[${index}].id`),
    network: requiredText(stop.network, `stops[${index}].network`),
    qualityStatus: 'confirmed',
    source: requiredText(stop.source, `stops[${index}].source`),
    sourceReference: requiredText(stop.sourceReference, `stops[${index}].sourceReference`),
    name: requiredText(stop.name, `stops[${index}].name`),
    coordinates: assertCoordinates(stop.coordinates, `stops[${index}].coordinates`),
    aliases: stop.aliases.map((alias) => alias.trim()).filter(Boolean),
  };
}

/** Validates a single directed route while preserving the source stop order. */
export function validateTransitDirection(value: unknown): TransitDirection {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Transit direction must be an object');
  }

  const direction = value as Partial<TransitDirection>;
  const network = requiredText(direction.network, 'Network') as NetworkId;
  if (direction.qualityStatus !== 'confirmed') {
    throw new TypeError('Transit direction must be confirmed before route search');
  }
  const source = requiredText(direction.source, 'Direction source');
  const receiverQuestion = requiredText(direction.receiverQuestion, 'Receiver question');
  if (!Array.isArray(direction.stops) || direction.stops.length < 2) {
    throw new TypeError('Transit direction must contain at least two ordered stops');
  }

  const stops = direction.stops.map((stop, index) => validateStop(stop, index, network));
  const stopIds = new Set(stops.map(({ id }) => id));
  if (stopIds.size !== stops.length) {
    throw new TypeError('Transit direction stop ids must be unique');
  }

  return {
    id: requiredText(direction.id, 'Direction id'),
    network,
    networkName: requiredText(direction.networkName, 'Network name'),
    qualityStatus: 'confirmed',
    source,
    lineNumber: requiredText(direction.lineNumber, 'Line number'),
    directionName: requiredText(direction.directionName, 'Direction name'),
    displayedDestinationLabel: requiredText(
      direction.displayedDestinationLabel,
      'Displayed destination label',
    ),
    receiverQuestion,
    stops,
  };
}

/** Parses either a route-ready stop or an incomplete source record without inventing fields. */
export function validateTransitStopRecord(value: unknown): TransitStopRecord {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Transit stop record must be an object');
  }
  const record = value as Record<string, unknown>;
  const id = requiredText(record.id, 'Stop id');
  const network = requiredText(record.network, 'Network') as NetworkId;
  const source = requiredText(record.source, 'Stop source');
  const sourceReference = record.sourceReference === undefined || record.sourceReference === null
    ? undefined
    : requiredText(record.sourceReference, 'Stop source reference');

  if (record.qualityStatus === 'incomplete' || record.qualityStatus === 'needs_verification') {
    const name = record.name === undefined || record.name === null
      ? record.name as null | undefined
      : requiredText(record.name, 'Stop name');
    const coordinates = record.coordinates === undefined || record.coordinates === null
      ? record.coordinates as null | undefined
      : assertCoordinates(record.coordinates, 'Stop coordinates');
    const aliases = record.aliases === undefined
      ? undefined
      : Array.isArray(record.aliases) && record.aliases.every((alias) => typeof alias === 'string')
        ? record.aliases.map((alias) => (alias as string).trim()).filter(Boolean)
        : (() => { throw new TypeError('Stop aliases must be a list of strings'); })();

    return {
      id,
      network,
      qualityStatus: record.qualityStatus,
      source,
      ...(sourceReference ? { sourceReference } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(coordinates !== undefined ? { coordinates } : {}),
      ...(aliases !== undefined ? { aliases } : {}),
    };
  }

  if (record.qualityStatus !== 'confirmed') {
    throw new TypeError('Stop quality status is invalid');
  }
  const aliases = record.aliases;
  if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== 'string')) {
    throw new TypeError('Stop aliases must be a list of strings');
  }
  return {
    id,
    network,
    qualityStatus: 'confirmed',
    source,
    sourceReference: requiredText(record.sourceReference, 'Stop source reference'),
    name: requiredText(record.name, 'Stop name'),
    coordinates: assertCoordinates(record.coordinates, 'Stop coordinates'),
    aliases: aliases.map((alias) => (alias as string).trim()).filter(Boolean),
  };
}

export function isRoutableTransitStop(stop: TransitStopRecord): stop is TransitStop {
  return stop.qualityStatus === 'confirmed';
}

export function listContributionStops(stops: readonly TransitStopRecord[]): UnverifiedTransitStop[] {
  return stops.filter((stop): stop is UnverifiedTransitStop => stop.qualityStatus !== 'confirmed');
}
