import { describe, expect, it } from 'vitest';
import { matchPlaceCandidates } from './place';

describe('matchPlaceCandidates', () => {
  it('keeps a matched alias, canonical place, and served area distinct', () => {
    const candidates = matchPlaceCandidates('ISM', [
      {
        id: 'ism',
        displayName: 'Institut Supérieur de Management',
        areaName: 'Université',
        coordinates: { lat: 14.693, lon: -17.463 },
        aliases: ['ISM'],
      },
    ]);

    expect(candidates).toEqual([
      {
        id: 'ism',
        displayName: 'Institut Supérieur de Management',
        areaName: 'Université',
        coordinates: { lat: 14.693, lon: -17.463 },
        matchedAlias: 'ISM',
        source: 'catalogue',
      },
    ]);
    expect(candidates[0]).not.toHaveProperty('displayedDestinationLabel');
  });

  it('returns every matching place so an ambiguous name is not guessed', () => {
    const place = {
      displayName: 'Centre de formation',
      areaName: 'SICAP',
      coordinates: { lat: 14.7, lon: -17.45 },
      aliases: ['CFP'],
    };

    const candidates = matchPlaceCandidates('CFP', [
      { id: 'cfp-a', ...place },
      { id: 'cfp-b', ...place, areaName: 'Liberté' },
    ]);

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      'cfp-a',
      'cfp-b',
    ]);
  });
});
