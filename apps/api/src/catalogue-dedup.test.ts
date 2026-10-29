import { describe, expect, it, vi } from 'vitest';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import { createPlaceResolver } from './places';

describe('catalogue candidate deduplication across directions', () => {
  it('returns one non-ambiguous place per id while retaining both directions in the snapshot', async () => {
    const snapshot = {
      directions: [
        { id: 'direction-24-out', lineNumber: '24' },
        { id: 'direction-24-in', lineNumber: '24' },
      ],
      servedPlaces: [
        { placeId: 'ism', directionId: 'direction-24-out' },
        { placeId: 'ism', directionId: 'direction-24-in' },
      ],
    };
    const candidates: PlaceCandidate[] = snapshot.servedPlaces.map(() => ({
      id: 'ism',
      displayName: 'Institut Supérieur de Management',
      areaName: 'Université',
      coordinates: { lat: 14.696, lon: -17.463 },
      matchedAlias: 'ISM',
      source: 'catalogue',
    }));
    const catalogue = { search: vi.fn(async () => candidates) };
    const geocoder = { search: vi.fn(async () => []) };
    const resolvePlaces = createPlaceResolver({ catalogue, geocoder });

    const result = await resolvePlaces('ISM', 'fr');

    expect(result.kind).toBe('matches');
    expect(result.places).toHaveLength(1);
    expect(result.places[0].id).toBe('ism');
    expect(snapshot.directions.map(({ id }) => id)).toEqual(['direction-24-out', 'direction-24-in']);
    expect(snapshot.servedPlaces).toHaveLength(2);
    expect(geocoder.search).not.toHaveBeenCalled();
  });
});
