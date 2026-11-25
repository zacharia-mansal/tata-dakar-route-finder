import { describe, expect, it } from 'vitest';
import { findJourneys, type RouteSearchInput, type SearchLimits } from './search';
import type { PlaceCandidate } from './place';
import type { TransitNetwork } from './journey';
import type { TransitDirection, TransitStop } from './transit';

const stop = (id: string, name: string, lat: number, lon: number): TransitStop => ({
  id,
  network: 'aftu_dakar',
  qualityStatus: 'confirmed',
  source: 'test_fixture',
  sourceReference: 'fixture-only',
  name,
  coordinates: { lat, lon },
  aliases: [],
});

const castor = stop('castor', 'Castor', 14.707, -17.451);
const liberte = stop('liberte', 'Liberté 6', 14.715, -17.455);
const universite = stop('universite', 'Université', 14.693, -17.463);
const ism: PlaceCandidate = {
  id: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates: { lat: 14.696, lon: -17.463 },
  matchedAlias: 'ISM',
  source: 'catalogue',
};

const direction = (id: string, lineNumber: string, directionName: string, label: string, question: string, stops: TransitStop[]): TransitDirection => ({
  id,
  network: 'aftu_dakar',
  networkName: 'AFTU Dakar',
  qualityStatus: 'confirmed',
  source: 'test_fixture',
  lineNumber,
  directionName,
  displayedDestinationLabel: label,
  receiverQuestion: question,
  stops,
});

const limits: SearchLimits = {
  maxTransfers: 2,
  maxOriginWalkMeters: 800,
  maxDestinationWalkMeters: 1200,
  maxResults: 3,
};

const input: RouteSearchInput = {
  network: 'aftu_dakar',
  origin: { kind: 'coordinates', coordinates: castor.coordinates },
  destination: ism,
  locale: 'fr',
};

describe('findJourneys', () => {
  it('preserves direction, ordered stops, receiver wording and the verified served-place mapping', () => {
    const outbound = direction(
      '24-to-universite',
      '24',
      'Castor vers Université',
      'Université',
      'Est-ce que ça va vers l’Université ?',
      [castor, liberte, universite],
    );
    const network: TransitNetwork = {
      directions: [outbound],
      stops: [castor, liberte, universite],
      servedPlaces: [{
        placeId: 'ism',
        areaName: 'Université',
        directionId: outbound.id,
        alightingStopId: universite.id,
        verifiedAt: '2026-10-22T12:00:00.000Z',
      }],
    };

    const [journey] = findJourneys(network, input, limits);

    expect(journey.legs).toHaveLength(1);
    expect(journey.legs[0]).toMatchObject({
      directionId: '24-to-universite',
      lineNumber: '24',
      directionName: 'Castor vers Université',
      displayedDestinationLabel: 'Université',
      receiverQuestion: 'Est-ce que ça va vers l’Université ?',
      boardingStop: { id: 'castor' },
      alightingStop: { id: 'universite' },
      orderedStops: [{ id: 'castor' }, { id: 'liberte' }, { id: 'universite' }],
    });
    expect(journey.searchedDestination.displayName).toBe('Institut Supérieur de Management');
    expect(journey.servedAreaName).toBe('Université');
    expect(journey.verifiedAt).toBe('2026-10-22T12:00:00.000Z');
  });

  it('keeps identical line numbers isolated to the selected network', () => {
    const aftu = {
      ...direction('aftu-24', '24', 'AFTU vers Centre', 'Centre', 'Question Centre', [castor, universite]),
      network: 'aftu_dakar',
    };
    const tataStops = [castor, universite].map((stop) => ({ ...stop, network: 'tata_thies' as const }));
    const tataThies = {
      ...direction('tata-24', '24', 'TATA vers Centre', 'Centre', 'Question Centre', tataStops),
      network: 'tata_thies',
    };
    const multiNetwork: TransitNetwork = {
      directions: [aftu, tataThies],
      stops: [castor, universite],
      servedPlaces: [aftu, tataThies].map((route) => ({
        placeId: 'ism',
        areaName: 'Centre',
        directionId: route.id,
        alightingStopId: universite.id,
        verifiedAt: '2026-10-22T12:00:00.000Z',
      })),
    };

    const results = findJourneys(multiNetwork, { ...input, network: 'aftu_dakar' }, limits);

    expect(results.map((journey) => journey.legs[0].directionId)).toEqual(['aftu-24']);
  });

  it('never returns a direction whose quality status is not confirmed', () => {
    const unverified = {
      ...direction('candidate-route', '24', 'Candidate route', 'Université', 'Fixture wording', [castor, universite]),
      qualityStatus: 'incomplete',
    } as unknown as TransitDirection;
    const network: TransitNetwork = {
      directions: [unverified],
      stops: [castor, universite],
      servedPlaces: [{ placeId: 'ism', areaName: 'Université', directionId: unverified.id, alightingStopId: universite.id, verifiedAt: '2026-10-22T12:00:00.000Z' }],
    };

    expect(findJourneys(network, input, limits)).toEqual([]);
  });

  it('never returns a direction containing an unconfirmed stop', () => {
    const incompleteStop = { ...castor, qualityStatus: 'incomplete' } as unknown as TransitStop;
    const unverifiedDirection = direction('route-with-incomplete-stop', '24', 'Route with candidate stop', 'Université', 'Fixture wording', [incompleteStop, universite]);
    const network: TransitNetwork = {
      directions: [unverifiedDirection],
      stops: [incompleteStop, universite],
      servedPlaces: [{ placeId: 'ism', areaName: 'Université', directionId: unverifiedDirection.id, alightingStopId: universite.id, verifiedAt: '2026-10-22T12:00:00.000Z' }],
    };

    expect(findJourneys(network, input, limits)).toEqual([]);
  });

  it('keeps the two directions of a line distinct and never reverses their stop order', () => {
    const toUniversity = direction('24-out', '24', 'Castor vers Université', 'Université', 'Question Université', [castor, universite]);
    const toCastor = direction('24-back', '24', 'Université vers Castor', 'Castor', 'Question Castor', [universite, castor]);
    const network: TransitNetwork = {
      directions: [toUniversity, toCastor],
      stops: [castor, universite],
      servedPlaces: [{
        placeId: 'ism',
        areaName: 'Université',
        directionId: toUniversity.id,
        alightingStopId: universite.id,
        verifiedAt: '2026-10-22T12:00:00.000Z',
      }],
    };

    const [journey] = findJourneys(network, input, limits);

    expect(journey.legs[0].directionId).toBe('24-out');
    expect(journey.legs[0].orderedStops.map(({ id }) => id)).toEqual(['castor', 'universite']);
  });

  it('requires an exact served-place association and does not substitute matching place or bus labels', () => {
    const wrongDirection = direction('24-out', '24', 'Castor vers Université', 'Université', 'Question Université', [castor, universite]);
    const network: TransitNetwork = {
      directions: [wrongDirection],
      stops: [castor, universite],
      servedPlaces: [{
        placeId: 'another-place',
        areaName: 'Université',
        directionId: wrongDirection.id,
        alightingStopId: universite.id,
        verifiedAt: '2026-10-22T12:00:00.000Z',
      }],
    };

    expect(findJourneys(network, input, limits)).toEqual([]);
  });

  it('can use one verified transfer between stops at most 200 metres apart and respects the transfer limit', () => {
    const transferA = stop('transfer-a', 'Liberté 6', 14.715, -17.455);
    const transferB = stop('transfer-b', 'Liberté 6', 14.7155, -17.455);
    const first = direction('24-to-transfer', '24', 'Castor vers Liberté', 'Liberté', 'Question Liberté', [castor, transferA]);
    const second = direction('3-to-universite', '3', 'Liberté vers Université', 'Université', 'Question Université', [transferB, universite]);
    const network: TransitNetwork = {
      directions: [first, second],
      stops: [castor, transferA, transferB, universite],
      servedPlaces: [{
        placeId: 'ism',
        areaName: 'Université',
        directionId: second.id,
        alightingStopId: universite.id,
        verifiedAt: '2026-10-22T12:00:00.000Z',
      }],
    };

    expect(findJourneys(network, input, { ...limits, maxTransfers: 0 })).toEqual([]);
    const [journey] = findJourneys(network, input, { ...limits, maxTransfers: 1 });
    expect(journey.transferCount).toBe(1);
    expect(journey.legs.map(({ directionId }) => directionId)).toEqual(['24-to-transfer', '3-to-universite']);
  });

  it('rejects a route when destination walking exceeds a non-zero limit', () => {
    const outbound = direction('24-out', '24', 'Castor vers Université', 'Université', 'Question Université', [castor, universite]);
    const network: TransitNetwork = {
      directions: [outbound],
      stops: [castor, universite],
      servedPlaces: [{
        placeId: 'ism',
        areaName: 'Université',
        directionId: outbound.id,
        alightingStopId: universite.id,
        verifiedAt: '2026-10-22T12:00:00.000Z',
      }],
    };

    expect(findJourneys(network, input, { ...limits, maxDestinationWalkMeters: 200 })).toEqual([]);
  });

  it('orders candidates by transfers, total walking, and stop count before enforcing maxResults', () => {
    const nearDestination = stop('near-destination', 'Université', 14.6955, -17.463);
    const fartherDestination = stop('farther-destination', 'Université', 14.694, -17.463);
    const extra = stop('extra', 'Liberté', 14.715, -17.455);
    const offsetBoarding = stop('offset-boarding', 'Castor proche', 14.706, -17.451);
    const transferA = stop('transfer-a', 'Castor', 14.707, -17.451);
    const transferB = stop('transfer-b', 'Castor', 14.7075, -17.451);
    const fewestWalk = direction('fewest-walk', '24', 'Marche la plus courte', 'Université', 'Question 24', [castor, nearDestination]);
    const moreStops = direction('more-stops', '25', 'Même marche, plus d’arrêts', 'Université', 'Question 25', [castor, extra, nearDestination]);
    const originWalk = direction('origin-walk', '26', 'Marche départ plus longue', 'Université', 'Question 26', [offsetBoarding, nearDestination]);
    const destinationWalk = direction('destination-walk', '27', 'Marche destination plus longue', 'Université', 'Question 27', [castor, fartherDestination]);
    const transferFirst = direction('transfer-first', '28', 'Vers correspondance', 'Castor', 'Question 28', [castor, transferA]);
    const transferLast = direction('transfer-last', '29', 'Correspondance vers Université', 'Université', 'Question 29', [transferB, nearDestination]);
    const network: TransitNetwork = {
      directions: [fewestWalk, moreStops, originWalk, destinationWalk, transferFirst, transferLast],
      stops: [castor, nearDestination, fartherDestination, extra, offsetBoarding, transferA, transferB],
      servedPlaces: [fewestWalk, moreStops, originWalk, destinationWalk, transferLast].map((item) => ({
        placeId: 'ism', areaName: 'Université', directionId: item.id,
        alightingStopId: item.stops[item.stops.length - 1].id, verifiedAt: '2026-10-22T12:00:00.000Z',
      })),
    };

    const results = findJourneys(network, input, { ...limits, maxTransfers: 1, maxResults: 4 });

    expect(results.map((journey) => journey.legs.map(({ directionId }) => directionId))).toEqual([
      ['fewest-walk'],
      ['more-stops'],
      ['transfer-last'],
      ['origin-walk'],
    ]);
    expect(results).toHaveLength(4);
    expect(results.some((journey) => journey.transferCount > 0)).toBe(false);
  });

  it('excludes destination-walk at maxResults=4 only because the ranked list is truncated', () => {
    const nearDestination = stop('near-destination', 'Université', 14.6955, -17.463);
    const fartherDestination = stop('farther-destination', 'Université', 14.694, -17.463);
    const extra = stop('extra', 'Liberté', 14.715, -17.455);
    const offsetBoarding = stop('offset-boarding', 'Castor proche', 14.706, -17.451);
    const transferA = stop('transfer-a', 'Castor', 14.707, -17.451);
    const transferB = stop('transfer-b', 'Castor', 14.7075, -17.451);
    const fewestWalk = direction('fewest-walk', '24', 'Marche la plus courte', 'Université', 'Question 24', [castor, nearDestination]);
    const moreStops = direction('more-stops', '25', 'Même marche, plus d’arrêts', 'Université', 'Question 25', [castor, extra, nearDestination]);
    const originWalk = direction('origin-walk', '26', 'Marche départ plus longue', 'Université', 'Question 26', [offsetBoarding, nearDestination]);
    const destinationWalk = direction('destination-walk', '27', 'Marche destination plus longue', 'Université', 'Question 27', [castor, fartherDestination]);
    const transferFirst = direction('transfer-first', '28', 'Vers correspondance', 'Castor', 'Question Castor', [castor, transferA]);
    const transferLast = direction('transfer-last', '29', 'Correspondance vers Université', 'Université', 'Question 29', [transferB, nearDestination]);
    const network: TransitNetwork = {
      directions: [fewestWalk, moreStops, originWalk, destinationWalk, transferFirst, transferLast],
      stops: [castor, nearDestination, fartherDestination, extra, offsetBoarding, transferA, transferB],
      servedPlaces: [fewestWalk, moreStops, originWalk, destinationWalk, transferLast].map((item) => ({
        placeId: 'ism', areaName: 'Université', directionId: item.id,
        alightingStopId: item.stops[item.stops.length - 1].id, verifiedAt: '2026-10-22T12:00:00.000Z',
      })),
    };
    const commonLimits = { ...limits, maxTransfers: 1 };

    const fourResults = findJourneys(network, input, { ...commonLimits, maxResults: 4 });
    const fiveResults = findJourneys(network, input, { ...commonLimits, maxResults: 5 });

    expect(fourResults.map((journey) => journey.legs.map(({ directionId }) => directionId))).toEqual([
      ['fewest-walk'],
      ['more-stops'],
      ['transfer-last'],
      ['origin-walk'],
    ]);
    expect(fiveResults.map((journey) => journey.legs.map(({ directionId }) => directionId))).toEqual([
      ['fewest-walk'],
      ['more-stops'],
      ['transfer-last'],
      ['origin-walk'],
      ['destination-walk'],
    ]);
  });
});
