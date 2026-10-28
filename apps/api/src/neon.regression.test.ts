import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPublishedNetworkReader,
  publishedNetworkSql,
  type PublishedNetworkQuery,
} from './neon';

const neonHarness = vi.hoisted(() => ({ neon: vi.fn(), query: vi.fn() }));
vi.mock('@neondatabase/serverless', () => ({ neon: neonHarness.neon }));

const fixtureConnectionValue = 'pooled-fixture-value';
const fixtureRows = [{
  line_id: 'line-fixture',
  line_number: '24',
  direction_id: 'direction-24-out',
  direction_name: 'Castor vers Université',
  displayed_destination_label: 'Université',
  receiver_question: 'Est-ce que ça va vers l’Université ?',
  verified_at: '2026-10-22T12:00:00.000Z',
  stops: [{ id: 'university', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] }],
  served_places: [{
    place_id: 'ism',
    display_name: 'Institut Supérieur de Management',
    area_name: 'Université',
    coordinates: { lat: 14.696, lon: -17.463 },
    alighting_stop_id: 'university',
    verified_at: '2026-10-22T12:00:00.000Z',
    aliases: [],
  }],
  route_shape: null,
}];

function injectedReader(query: PublishedNetworkQuery = neonHarness.query) {
  return createPublishedNetworkReader({ connectionString: fixtureConnectionValue, query });
}

describe('published network Neon HTTP regressions', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL_PUBLIC_API', fixtureConnectionValue);
    neonHarness.neon.mockReset();
    neonHarness.query.mockReset();
    const sql = Object.assign(vi.fn(), { query: neonHarness.query });
    neonHarness.neon.mockReturnValue(sql);
    neonHarness.query.mockResolvedValue(fixtureRows);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('creates the Neon HTTP query client from DATABASE_URL_PUBLIC_API', () => {
    try {
      createPublishedNetworkReader();
    } catch {
      // Keep the regression assertion observable while the no-argument factory is missing.
    }

    expect(neonHarness.neon).toHaveBeenCalledTimes(1);
  });

  it('passes the environment value to neon() without replacing it with a client-side URL', () => {
    try {
      createPublishedNetworkReader();
    } catch {
      // The assertion below reports whether factory creation reached neon().
    }

    expect(neonHarness.neon.mock.calls[0]?.[0]).toBe(fixtureConnectionValue);
  });

  it('queries the qualified published view through an injected query with no real DB', async () => {
    const reader = injectedReader();

    await reader.load();

    expect(neonHarness.query.mock.calls[0]?.[0]).toBe(publishedNetworkSql);
    expect(publishedNetworkSql).toMatch(/from\s+public\.published_transit_network/i);
  });

  it('passes the caller AbortSignal as Neon fetchOptions on the query', async () => {
    const controller = new AbortController();
    const reader = injectedReader();

    await reader.load({ signal: controller.signal });

    expect(neonHarness.query).toHaveBeenCalledWith(
      publishedNetworkSql,
      [],
      expect.objectContaining({ fetchOptions: expect.objectContaining({ signal: controller.signal }) }),
    );
  });

  it('maps the SQL direction_id column to the domain direction id', async () => {
    const reader = injectedReader();
    const network = await reader.load();

    expect(network.directions[0].id).toBe('direction-24-out');
  });

  it('maps snake_case served-place JSON and associates it with the row direction_id', async () => {
    const reader = injectedReader();
    const network = await reader.load();

    expect(network.servedPlaces[0]).toMatchObject({
      placeId: 'ism',
      areaName: 'Université',
      directionId: 'direction-24-out',
      alightingStopId: 'university',
      verifiedAt: '2026-10-22T12:00:00.000Z',
    });
  });

  it('reports the missing environment variable without including a connection value', () => {
    vi.stubEnv('DATABASE_URL_PUBLIC_API', '');

    expect(() => createPublishedNetworkReader({ query: vi.fn() })).toThrow(/DATABASE_URL_PUBLIC_API/);
  });

  it('does not leak the configured connection value when the Neon query fails', async () => {
    const reader = injectedReader(async () => {
      throw new Error('fixture transport failure: ' + fixtureConnectionValue);
    });
    let failure: unknown;
    try {
      await reader.load();
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain(fixtureConnectionValue);
  });
});