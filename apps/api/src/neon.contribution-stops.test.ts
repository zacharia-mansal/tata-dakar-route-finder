import { describe, expect, it, vi } from 'vitest';
import { contributionStopsSql, createContributionStopReader } from './neon';

describe('createContributionStopReader', () => {
  it('queries only the selected network from the coordinate-free incomplete view', async () => {
    const query = vi.fn(async () => [{
      id: 'FICTIF-stop-1',
      network: 'tata_thies',
      qualityStatus: 'incomplete',
      source: 'FICTIF-test-source',
      sourceReference: 'FICTIF-reference',
      name: null,
    }]);
    const reader = createContributionStopReader({ connectionString: 'postgresql://fixture', query });

    await expect(reader.load('tata_thies')).resolves.toEqual([{
      id: 'FICTIF-stop-1',
      network: 'tata_thies',
      qualityStatus: 'incomplete',
      source: 'FICTIF-test-source',
      sourceReference: 'FICTIF-reference',
      name: null,
    }]);
    expect(query).toHaveBeenCalledWith(contributionStopsSql, ['tata_thies'], { fetchOptions: { signal: expect.any(AbortSignal) } });
    expect(contributionStopsSql).toContain('public.contribution_incomplete_stops');
  });

  it('does not expose database details when the read fails', async () => {
    const reader = createContributionStopReader({
      connectionString: 'postgresql://fixture',
      query: async () => { throw new Error('FICTIF-private-database-detail'); },
    });

    await expect(reader.load('aftu_dakar')).rejects.toThrow('Unable to load contribution stops');
    await expect(reader.load('aftu_dakar')).rejects.not.toThrow('FICTIF-private-database-detail');
  });
});
