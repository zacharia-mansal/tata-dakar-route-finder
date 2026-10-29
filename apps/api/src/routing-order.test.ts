import { describe, expect, it, vi } from 'vitest';
import type { TransitNetwork, WalkSegment } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import { searchRoutesWithMetadata } from './routing';

const origin = { lat: 14.707, lon: -17.451 };
const destinationCoordinates = { lat: 14.695, lon: -17.463 };
const destination: PlaceCandidate = {
  id: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates: destinationCoordinates,
  source: 'catalogue',
};

function makeNetwork(): TransitNetwork {
  const directionIds = ['route-z', 'route-a'];
  const directions = directionIds.map((id) => ({
    id,
    lineNumber: '24',
    directionName: 'Castor vers Université',
    displayedDestinationLabel: 'Université',
    receiverQuestion: 'Est-ce que ça va vers l’Université ?',
    stops: [
      { id: `${id}-start`, name: 'Castor', coordinates: origin, aliases: [] },
      { id: `${id}-end`, name: 'Université', coordinates: destinationCoordinates, aliases: [] },
    ],
  }));

  return {
    directions,
    stops: directions.flatMap(({ stops }) => stops),
    servedPlaces: directions.map((direction) => ({
      placeId: destination.id,
      areaName: 'Université',
      directionId: direction.id,
      alightingStopId: `${direction.id}-end`,
      verifiedAt: '2026-10-22T12:00:00.000Z',
    })),
  };
}

function walk(from: { lat: number; lon: number }, to: { lat: number; lon: number }): WalkSegment {
  return { distanceMeters: 100, instructions: ['Walk'], coordinates: [from, to] };
}

describe('deterministic journey tie-breaking', () => {
  it('orders equal routes by stable lexical direction ID without using runtime localeCompare', async () => {
    const localeCompareSpy = vi.spyOn(String.prototype, 'localeCompare').mockImplementation(() => {
      throw new Error('localeCompare depends on the runtime locale');
    });

    try {
      const result = await searchRoutesWithMetadata({
        network: makeNetwork(),
        origin: { kind: 'coordinates', coordinates: origin },
        destination,
        locale: 'fr',
        walking: { route: async ({ from, to }) => walk(from, to) },
      });

      expect(localeCompareSpy).not.toHaveBeenCalled();
      expect(result.routes.map((route) => route.legs[0]?.directionId)).toEqual(['route-a', 'route-z']);
    } finally {
      localeCompareSpy.mockRestore();
    }
  });
});
