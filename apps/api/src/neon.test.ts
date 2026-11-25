import { describe, expect, it, vi } from 'vitest';
import { createPublishedNetworkReader, publishedNetworkSql } from './neon';

describe('published Neon network reader', () => {
  it('requires the server-only API connection string and identifies the missing variable clearly', () => {
    expect(() => createPublishedNetworkReader({
      connectionString: undefined,
      query: vi.fn(),
    })).toThrow(/DATABASE_URL_PUBLIC_API/);
  });

  it('queries only the schema-qualified published view and never sets a session search_path', () => {
    expect(publishedNetworkSql).toMatch(/from\s+public\.published_transit_network_by_network/i);
    expect(publishedNetworkSql).not.toMatch(/\bset\s+(local\s+)?search_path\b/i);
    expect(publishedNetworkSql).not.toMatch(/from\s+public\.(pilot_areas|places|line_directions|direction_stops|served_places)\b/i);
  });

  it('loads fixture rows through an injected query without opening a real database connection', async () => {
    const rows = [{
      line_id: 'line-24', line_number: '24', direction_id: '24-out', direction_name: 'Castor vers Université',
      displayed_destination_label: 'Université', receiver_question: 'Question vérifiée', verified_at: '2026-10-22T12:00:00.000Z',
      network: 'aftu_dakar', network_name: 'AFTU Dakar', line_quality_status: 'confirmed',
      line_source: 'test_fixture', line_source_reference: 'fixture-only',
      stops: [
        { id: 'castor', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Castor', coordinates: { lat: 14.707, lon: -17.451 }, aliases: [] },
        { id: 'university', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] },
      ],
      served_places: [{
        place_id: 'ism', display_name: 'Institut Supérieur de Management', area_name: 'Université',
        coordinates: { lat: 14.696, lon: -17.463 }, alighting_stop_id: 'university',
        verified_at: '2026-10-22T12:00:00.000Z', aliases: [],
      }],
      route_shape: null,
    }];
    const query = vi.fn().mockResolvedValue(rows);
    const reader = createPublishedNetworkReader({ connectionString: 'fixture-connection-value', query });

    await expect(reader.load()).resolves.toEqual(expect.objectContaining({ directions: expect.any(Array) }));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toBe(publishedNetworkSql);
  });
});
