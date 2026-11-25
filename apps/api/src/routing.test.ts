import { describe, expect, it, vi } from 'vitest';
import { searchRoutes } from './routing';
import type { TransitNetwork, ServedPlace } from '../../../packages/domain/src/journey';
import type { TransitDirection } from '../../../packages/domain/src/transit';
import type { PlaceCandidate } from '../../../packages/domain/src/place';

const destination: PlaceCandidate = {
  id: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  // Keep the searched place away from the bus stop so destination walking is real.
  coordinates: { lat: 14.695, lon: -17.463 },
  source: 'catalogue',
};

const direction: TransitDirection = {
  id: '24-to-university',
  network: 'aftu_dakar',
  networkName: 'AFTU Dakar',
  qualityStatus: 'confirmed',
  source: 'test_fixture',
  lineNumber: '24',
  directionName: 'Castor vers Université',
  displayedDestinationLabel: 'Université',
  receiverQuestion: 'Est-ce que ça va vers l’Université ?',
  stops: [
    { id: 'castor', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Castor', coordinates: { lat: 14.707, lon: -17.451 }, aliases: [] },
    { id: 'university', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] },
  ],
};
const servedPlace: ServedPlace = {
  placeId: 'ism',
  areaName: 'Université',
  directionId: direction.id,
  alightingStopId: 'university',
  verifiedAt: '2026-10-22T12:00:00.000Z',
};
const network: TransitNetwork = { directions: [direction], stops: direction.stops, servedPlaces: [servedPlace] };

describe('route search service', () => {
  it('matches the searched place by served-place id and carries the exact direction and receiver wording', async () => {
    const walking = { route: vi.fn().mockResolvedValue({ distanceMeters: 120, instructions: ['Walk'], coordinates: [destination.coordinates] }) };
    const result = await searchRoutes({
      network,
      origin: { kind: 'coordinates', coordinates: direction.stops[0].coordinates },
      destination,
      locale: 'fr',
      walking,
    });

    expect(result[0]).toMatchObject({
      searchedDestination: { id: 'ism', displayName: 'Institut Supérieur de Management' },
      servedAreaName: 'Université',
      legs: [{ directionId: '24-to-university', displayedDestinationLabel: 'Université', receiverQuestion: 'Est-ce que ça va vers l’Université ?' }],
      verifiedAt: '2026-10-22T12:00:00.000Z',
    });
    expect(walking.route).toHaveBeenCalled();
  });

  it('does not return a route just because a bus label happens to equal a place or alias', async () => {
    const unrelatedNetwork: TransitNetwork = {
      ...network,
      servedPlaces: [{ ...servedPlace, placeId: 'another-place' }],
    };
    const walking = { route: vi.fn() };

    const result = await searchRoutes({
      network: unrelatedNetwork,
      origin: { kind: 'coordinates', coordinates: direction.stops[0].coordinates },
      destination,
      locale: 'fr',
      walking,
    });

    expect(result).toEqual([]);
    expect(walking.route).not.toHaveBeenCalled();
  });

  it('uses an injected walking provider and never relies on a provider network call in the test', async () => {
    const walking = { route: vi.fn().mockResolvedValue({ distanceMeters: 500, instructions: ['Walk to stop'], coordinates: [direction.stops[0].coordinates] }) };
    const networkFetch = vi.fn(() => { throw new Error('Unexpected network call from test'); });
    vi.stubGlobal('fetch', networkFetch);

    try {
      await searchRoutes({
        network,
        origin: { kind: 'coordinates', coordinates: { lat: 14.706, lon: -17.451 } },
        destination,
        locale: 'en',
        walking,
      });

      expect(walking.route).toHaveBeenCalledTimes(2);
      expect(walking.route).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
      expect(networkFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('times out an injected walking provider after four seconds', async () => {
    vi.useFakeTimers();
    const walking = { route: vi.fn(() => new Promise<never>(() => undefined)) };

    try {
      const pending = searchRoutes({
        network,
        origin: { kind: 'coordinates', coordinates: { lat: 14.706, lon: -17.451 } },
        destination,
        locale: 'fr',
        walking,
      });
      const rejected = expect(pending).rejects.toThrow(/timeout/i);
      await vi.advanceTimersByTimeAsync(4_001);
      await rejected;
      expect(walking.route).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
