import { assertCoordinates, type Coordinates } from './map';

export interface PlaceCandidate {
  id: string;
  displayName: string;
  areaName: string;
  coordinates: Coordinates;
  matchedAlias?: string;
  source: 'catalogue' | 'geocoder';
}

export interface PlaceRecord {
  id: string;
  displayName: string;
  areaName: string;
  coordinates: Coordinates;
  aliases: string[];
}

function normalizePlaceName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr');
}

/** Returns all catalog matches so the caller can ask the user to disambiguate. */
export function matchPlaceCandidates(
  query: string,
  places: readonly PlaceRecord[],
): PlaceCandidate[] {
  const normalizedQuery = normalizePlaceName(query);
  if (!normalizedQuery) return [];

  const matches: PlaceCandidate[] = [];
  const seenIds = new Set<string>();

  for (const place of places) {
    if (seenIds.has(place.id)) continue;

    const canonicalMatch = normalizePlaceName(place.displayName) === normalizedQuery;
    const matchedAlias = place.aliases.find(
      (alias) => normalizePlaceName(alias) === normalizedQuery,
    );
    if (!canonicalMatch && matchedAlias === undefined) continue;

    matches.push({
      id: place.id,
      displayName: place.displayName,
      areaName: place.areaName,
      coordinates: assertCoordinates(place.coordinates, `Place ${place.id} coordinates`),
      ...(matchedAlias === undefined ? {} : { matchedAlias }),
      source: 'catalogue',
    });
    seenIds.add(place.id);
  }

  return matches;
}
