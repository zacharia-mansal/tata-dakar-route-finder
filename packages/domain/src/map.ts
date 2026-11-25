export interface Coordinates {
  lat: number;
  lon: number;
}

export type JourneySegment =
  | { kind: 'walk'; coordinates: Coordinates[] }
  | { kind: 'tata'; coordinates: Coordinates[]; lineNumber: string; network: string };

export interface JourneyGeometry {
  segments: JourneySegment[];
  bounds: [west: number, south: number, east: number, north: number];
}

export interface MapMarker {
  id: string;
  coordinate: Coordinates;
  kind: 'origin' | 'boarding' | 'alighting' | 'destination';
  label: string;
}

export function isCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== 'object' || value === null) return false;

  const { lat, lon } = value as Partial<Coordinates>;
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

export function assertCoordinates(value: unknown, fieldName = 'coordinates'): Coordinates {
  if (!isCoordinates(value)) {
    throw new TypeError(`${fieldName} must contain valid latitude and longitude`);
  }

  return { lat: value.lat, lon: value.lon };
}
