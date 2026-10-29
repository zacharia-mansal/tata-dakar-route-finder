import { describe, expect, it, vi } from 'vitest';
import { searchRoutes } from './routing';
import type { TransitNetwork } from '../../../packages/domain/src/journey';
import type { TransitDirection } from '../../../packages/domain/src/transit';
import type { PlaceCandidate } from '../../../packages/domain/src/place';

const originCoordinates = { lat: 14.707, lon: -17.451 };
const destination: PlaceCandidate = {
  id: 'ism', displayName: 'Institut Supérieur de Management', areaName: 'Université',
  coordinates: { lat: 14.695, lon: -17.463 }, source: 'catalogue',
};

function direction(id: string, lineNumber: string, stops: TransitDirection['stops']): TransitDirection {
  return {
    id, lineNumber, directionName: `${lineNumber} vers Université`,
    displayedDestinationLabel: 'Université', receiverQuestion: 'Est-ce que ça va vers l’Université ?', stops,
  };
}

function network(directions: TransitDirection[]): TransitNetwork {
  return {
    directions,
    stops: directions.flatMap(({ stops }) => stops),
    servedPlaces: directions.map((item) => ({
      placeId: 'ism', areaName: 'Université', directionId: item.id,
      alightingStopId: item.stops[item.stops.length - 1].id, verifiedAt: '2026-10-22T12:00:00.000Z',
    })),
  };
}

function walkResult(distanceMeters: number, coordinates: { lat: number; lon: number }[]) {
  return { distanceMeters, instructions: ['Walk fixture'], coordinates };
}

describe('route search targeted regressions', () => {
  it('uses routed walking geometry instead of replacing it with a straight line', async () => {
    const alighting = { id: 'university', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] };
    const routeGeometry = [
      alighting.coordinates,
      { lat: 14.694, lon: -17.465 },
      destination.coordinates,
    ];
    const walking = {
      route: vi.fn(async ({ from, to }: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }) =>
        from.lat === alighting.coordinates.lat
          ? walkResult(300, routeGeometry)
          : walkResult(0, [from, to])),
    };
    const results = await searchRoutes({
      network: network([direction('24-out', '24', [
        { id: 'castor', name: 'Castor', coordinates: originCoordinates, aliases: [] },
        alighting,
      ])]),
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination,
      locale: 'fr',
      walking,
    });
    const routedWalkSegments = results[0].geometry.segments.filter((segment) => segment.kind === 'walk');

    expect(routedWalkSegments.at(-1)?.coordinates).toEqual(routeGeometry);
  });

  it('enforces the real 800 metre origin walking limit after provider routing', async () => {
    const boarding = { id: 'boarding', name: 'Castor proche', coordinates: { lat: 14.706, lon: -17.451 }, aliases: [] };
    const alighting = { id: 'university', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] };
    const walking = {
      route: vi.fn(async ({ from, to }: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }) =>
        to.lat === boarding.coordinates.lat
          ? walkResult(801, [from, to])
          : walkResult(20, [from, to])),
    };
    const results = await searchRoutes({
      network: network([direction('24-out', '24', [boarding, alighting])]),
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination,
      locale: 'fr',
      walking,
      limits: { maxTransfers: 0, maxOriginWalkMeters: 800, maxDestinationWalkMeters: 1200, maxResults: 3 },
    });

    expect(results).toEqual([]);
  });

  it('enforces the real 1200 metre destination walking limit after provider routing', async () => {
    const boarding = { id: 'castor', name: 'Castor', coordinates: originCoordinates, aliases: [] };
    const alighting = { id: 'university', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] };
    const walking = {
      route: vi.fn(async ({ from, to }: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }) =>
        from.lat === alighting.coordinates.lat
          ? walkResult(1201, [from, to])
          : walkResult(0, [from, to])),
    };
    const results = await searchRoutes({
      network: network([direction('24-out', '24', [boarding, alighting])]),
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination,
      locale: 'fr',
      walking,
      limits: { maxTransfers: 0, maxOriginWalkMeters: 800, maxDestinationWalkMeters: 1200, maxResults: 3 },
    });

    expect(results).toEqual([]);
  });

  it('routes and sorts all candidates before applying maxResults', async () => {
    const searchedDestination = { ...destination, coordinates: { lat: 14.696, lon: -17.463 } };
    const near = { id: 'near', name: 'Université', coordinates: { lat: 14.6958, lon: -17.463 }, aliases: [] };
    const farther = { id: 'farther', name: 'Université', coordinates: { lat: 14.695, lon: -17.463 }, aliases: [] };
    const walking = {
      route: vi.fn(async ({ from, to }: { from: { lat: number; lon: number }; to: { lat: number; lon: number } }) => {
        if (from.lat === near.coordinates.lat) return walkResult(1250, [from, to]);
        if (from.lat === farther.coordinates.lat) return walkResult(100, [from, to]);
        return walkResult(0, [from, to]);
      }),
    };
    const results = await searchRoutes({
      network: network([
        direction('straight-line-nearest', '24', [
          { id: 'castor-a', name: 'Castor', coordinates: originCoordinates, aliases: [] }, near,
        ]),
        direction('routed-walk-shortest', '25', [
          { id: 'castor-b', name: 'Castor', coordinates: originCoordinates, aliases: [] }, farther,
        ]),
      ]),
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination: searchedDestination,
      locale: 'fr',
      walking,
      limits: { maxTransfers: 0, maxOriginWalkMeters: 800, maxDestinationWalkMeters: 1200, maxResults: 1 },
    });

    expect(results.map(({ legs }) => legs[0].directionId)).toEqual(['routed-walk-shortest']);
    expect(results[0].totalWalkMeters).toBe(100);
  });
});