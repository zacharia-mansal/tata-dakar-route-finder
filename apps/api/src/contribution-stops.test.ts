import { describe, expect, it, vi } from 'vitest';
import { createContributionStopsHandler } from './contribution-stops';
import type { TransitStopRecord } from '../../../packages/domain/src/transit';

const records: TransitStopRecord[] = [
  {
    id: 'FICTIF-aftu-incomplete',
    network: 'aftu_dakar',
    qualityStatus: 'incomplete',
    source: 'FICTIF-test-source',
    name: 'FICTIF stop label',
  },
  {
    id: 'FICTIF-thies-incomplete',
    network: 'tata_thies',
    qualityStatus: 'incomplete',
    source: 'FICTIF-test-source',
  },
  {
    id: 'FICTIF-needs-review',
    network: 'aftu_dakar',
    qualityStatus: 'needs_verification',
    source: 'FICTIF-test-source',
  },
  {
    id: 'FICTIF-confirmed',
    network: 'aftu_dakar',
    qualityStatus: 'confirmed',
    source: 'FICTIF-test-source',
    sourceReference: 'FICTIF-reference',
    name: 'FICTIF confirmed stop',
    coordinates: { lat: 14.7, lon: -17.4 },
    aliases: [],
  },
];

const rateLimit = { check: async () => ({ allowed: true }) };

describe('GET /api/contribution-stops', () => {
  it.each(['aftu_dakar', 'tata_thies'] as const)('lists only incomplete stops in the requested network (%s)', async (network) => {
    const loadStopRecords = vi.fn(async () => records);
    const handler = createContributionStopsHandler({ loadStopRecords, rateLimit });
    const response = await handler(new Request(`https://api.example.test/api/contribution-stops?network=${network}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      kind: 'contribution_stops',
      network,
      stops: records
        .filter((stop) => stop.network === network && stop.qualityStatus === 'incomplete')
        .map(({ id, network: stopNetwork, qualityStatus, name }) => ({
          id,
          network: stopNetwork,
          qualityStatus,
          ...(name ? { name } : {}),
        })),
    });
    expect(loadStopRecords).toHaveBeenCalledWith(network, expect.any(AbortSignal));
    expect(JSON.stringify(body)).not.toContain('coordinates');
    expect(JSON.stringify(body)).not.toContain('FICTIF-reference');
  });

  it('rejects a missing or unsupported network without loading records', async () => {
    const loadStopRecords = vi.fn(async () => records);
    const handler = createContributionStopsHandler({ loadStopRecords, rateLimit });

    for (const url of [
      'https://api.example.test/api/contribution-stops',
      'https://api.example.test/api/contribution-stops?network=unknown',
    ]) {
      const response = await handler(new Request(url));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_request', message: 'Requête invalide.' });
    }
    expect(loadStopRecords).not.toHaveBeenCalled();
  });

  it('rejects non-GET methods without loading records', async () => {
    const loadStopRecords = vi.fn(async () => records);
    const handler = createContributionStopsHandler({ loadStopRecords, rateLimit });
    const response = await handler(new Request('https://api.example.test/api/contribution-stops?network=aftu_dakar', { method: 'POST' }));

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'method_not_allowed', message: 'Méthode non autorisée.' });
    expect(loadStopRecords).not.toHaveBeenCalled();
  });

  it('returns a safe 503 when the catalogue cannot be read', async () => {
    const handler = createContributionStopsHandler({
      loadStopRecords: async () => { throw new Error('FICTIF-internal-database-detail'); },
      rateLimit,
    });
    const response = await handler(new Request('https://api.example.test/api/contribution-stops?network=aftu_dakar'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'service_unavailable',
      message: 'La liste de contribution est temporairement indisponible.',
    });
  });

  it('honors Retry-After when the request limit is reached and skips the database', async () => {
    const loadStopRecords = vi.fn(async () => records);
    const handler = createContributionStopsHandler({
      loadStopRecords,
      rateLimit: { check: async () => ({ allowed: false, retryAfterSeconds: 17 }) },
    });
    const response = await handler(new Request('https://api.example.test/api/contribution-stops?network=aftu_dakar'));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('17');
    expect(await response.json()).toEqual({
      error: 'rate_limited',
      message: 'Trop de requêtes. Veuillez réessayer plus tard.',
    });
    expect(loadStopRecords).not.toHaveBeenCalled();
  });

  it('fails closed when the shared rate-limit store is unavailable', async () => {
    const loadStopRecords = vi.fn(async () => records);
    const handler = createContributionStopsHandler({
      loadStopRecords,
      rateLimit: { check: async () => ({ allowed: false, unavailable: true }) },
    });
    const response = await handler(new Request('https://api.example.test/api/contribution-stops?network=aftu_dakar'));

    expect(response.status).toBe(503);
    expect(loadStopRecords).not.toHaveBeenCalled();
  });
});
