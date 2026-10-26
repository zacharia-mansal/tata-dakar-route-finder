import { describe, expect, it } from 'vitest';
import { validateTransitDirection } from './transit';

const stops = [
  {
    id: 'castor',
    name: 'Castor',
    coordinates: { lat: 14.707, lon: -17.451 },
    aliases: ['Arrêt Castor'],
  },
  {
    id: 'jet-eau',
    name: 'Jet d’Eau',
    coordinates: { lat: 14.704, lon: -17.456 },
    aliases: [],
  },
  {
    id: 'universite',
    name: 'Université',
    coordinates: { lat: 14.693, lon: -17.463 },
    aliases: [],
  },
];

describe('validateTransitDirection', () => {
  it('preserves the verified stop order for one direction', () => {
    const direction = validateTransitDirection({
      id: 'line-24-castor-universite',
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
        lineNumber: '24',
        directionName: 'Castor vers Université',
        displayedDestinationLabel: 'Université',
        receiverQuestion: '   ',
        stops,
      }),
    ).toThrow(/receiver question/i);
  });
});
