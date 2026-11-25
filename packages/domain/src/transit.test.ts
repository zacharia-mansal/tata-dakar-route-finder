import { describe, expect, it } from 'vitest';
import {
  isRoutableTransitStop,
  listContributionStops,
  validateTransitDirection,
  validateTransitStopRecord,
} from './transit';

const stops = [
  {
    id: 'castor',
    network: 'aftu_dakar',
    qualityStatus: 'confirmed',
    source: 'test_fixture',
    sourceReference: 'fixture-only',
    name: 'Castor',
    coordinates: { lat: 14.707, lon: -17.451 },
    aliases: ['Arrêt Castor'],
  },
  {
    id: 'jet-eau',
    network: 'aftu_dakar',
    qualityStatus: 'confirmed',
    source: 'test_fixture',
    sourceReference: 'fixture-only',
    name: 'Jet d’Eau',
    coordinates: { lat: 14.704, lon: -17.456 },
    aliases: [],
  },
  {
    id: 'universite',
    network: 'aftu_dakar',
    qualityStatus: 'confirmed',
    source: 'test_fixture',
    sourceReference: 'fixture-only',
    name: 'Université',
    coordinates: { lat: 14.693, lon: -17.463 },
    aliases: [],
  },
];

describe('validateTransitDirection', () => {
  it('preserves the verified stop order for one direction', () => {
    const direction = validateTransitDirection({
      id: 'line-24-castor-universite',
      network: 'aftu_dakar',
      networkName: 'AFTU Dakar',
      qualityStatus: 'confirmed',
      source: 'test_fixture',
      lineNumber: '24',
      directionName: 'Castor vers Université',
      displayedDestinationLabel: 'Université',
      receiverQuestion: 'Est-ce que vous allez vers l’Université ?',
      stops,
    });

    expect(direction.stops.map((stop) => stop.id)).toEqual([
      'castor',
      'jet-eau',
      'universite',
    ]);
  });

  it('rejects a direction without a verified receiver question', () => {
    expect(() =>
      validateTransitDirection({
        id: 'line-24-castor-universite',
        network: 'aftu_dakar',
        networkName: 'AFTU Dakar',
        qualityStatus: 'confirmed',
        source: 'test_fixture',
        lineNumber: '24',
        directionName: 'Castor vers Université',
        displayedDestinationLabel: 'Université',
        receiverQuestion: '   ',
        stops,
      }),
    ).toThrow(/receiver question/i);
  });

  it('keeps incomplete stops without invented names or coordinates in contribution data only', () => {
    const stop = validateTransitStopRecord({
      id: 'candidate-stop',
      network: 'aftu_dakar',
      qualityStatus: 'incomplete',
      source: 'reference_externe',
    });

    expect(stop).toMatchObject({ id: 'candidate-stop', qualityStatus: 'incomplete' });
    expect(listContributionStops([stop])).toEqual([stop]);
    expect(isRoutableTransitStop(stop)).toBe(false);
  });

  it('rejects route directions whose stops come from a different network', () => {
    expect(() => validateTransitDirection({
      id: 'aftu-direction',
      network: 'aftu_dakar',
      networkName: 'AFTU Dakar',
      qualityStatus: 'confirmed',
      source: 'aftu_officiel',
      lineNumber: '24',
      directionName: 'AFTU vers Centre',
      displayedDestinationLabel: 'Centre',
      receiverQuestion: 'Centre ?',
      stops: [{ ...stops[0], network: 'tata_thies' }, stops[1]],
    })).toThrow(/same network/i);
  });
});
