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
    expect(publishedNetworkSql).toMatch(/from\s+public\.published_transit_network/i);
    expect(publishedNetworkSql).not.toMatch(/\bset\s+(local\s+)?search_path\b/i);
    expect(publishedNetworkSql).not.toMatch(/from\s+public\.(pilot_areas|places|line_directions|direction_stops|served_places)\b/i);
  });

  it('loads fixture rows through an injected query without opening a real database connection', async () => {
    const rows = [{
      line_id: 'line-24', line_number: '24', direction_id: '24-out', direction_name: 'Castor vers Université',
      displayed_destination_label: 'Université', receiver_question: 'Question vérifiée', verified_at: '2026-10-22T12:00:00.000Z',
      stops: [], served_places: [], route_shape: null,
    }];
    const query = vi.fn().mockResolvedValue(rows);
    const reader = createPublishedNetworkReader({ connectionString: 'fixture-connection-value', query });

    await expect(reader.load()).resolves.toEqual(expect.objectContaining({ directions: expect.any(Array) }));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toBe(publishedNetworkSql);
  });
});
