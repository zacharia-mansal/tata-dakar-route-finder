import { assertCoordinates, type Coordinates } from './map';

export interface TransitStop {
  id: string;
  name: string;
  coordinates: Coordinates;
  aliases: string[];
}

export interface TransitDirection {
  id: string;
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

function validateStop(value: unknown, index: number): TransitStop {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`stops[${index}] must be an object`);
  }

  const stop = value as Partial<TransitStop>;
  if (!Array.isArray(stop.aliases) || stop.aliases.some((alias) => typeof alias !== 'string')) {
    throw new TypeError(`stops[${index}].aliases must be a list of strings`);
  }

  return {
    id: requiredText(stop.id, `stops[${index}].id`),
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
  const receiverQuestion = requiredText(direction.receiverQuestion, 'Receiver question');
  if (!Array.isArray(direction.stops) || direction.stops.length < 2) {
    throw new TypeError('Transit direction must contain at least two ordered stops');
  }

  const stops = direction.stops.map(validateStop);
  const stopIds = new Set(stops.map(({ id }) => id));
  if (stopIds.size !== stops.length) {
    throw new TypeError('Transit direction stop ids must be unique');
  }

  return {
    id: requiredText(direction.id, 'Direction id'),
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
