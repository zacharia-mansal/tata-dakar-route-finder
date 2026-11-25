import { describe, expect, it, vi } from 'vitest';
import {
  createPublishedNetworkReader,
  type PublishedNetworkQuery,
  type PublishedNetworkRow,
} from './neon';

const rowWithoutRouteShape: PublishedNetworkRow = {
  line_id: 'line-24',
  line_number: '24',
  direction_id: '24-out',
  direction_name: 'Castor vers Université',
  displayed_destination_label: 'Université',
  receiver_question: 'Est-ce que ça va vers l’Université ?',
  verified_at: '2026-10-22T12:00:00.000Z',
  network: 'aftu_dakar',
  network_name: 'AFTU Dakar',
  line_quality_status: 'confirmed',
  line_source: 'test_fixture',
  line_source_reference: 'fixture-only',
  stops: [
    { id: 'castor', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Castor', coordinates: { lat: 14.707, lon: -17.451 }, aliases: [] },
    { id: 'university', network: 'aftu_dakar', qualityStatus: 'confirmed', source: 'test_fixture', sourceReference: 'fixture-only', name: 'Université', coordinates: { lat: 14.693, lon: -17.463 }, aliases: [] },
  ],
  served_places: [{
    place_id: 'ism',
    display_name: 'Institut Supérieur de Management',
    area_name: 'Université',
    coordinates: { lat: 14.696, lon: -17.463 },
    alighting_stop_id: 'university',
    verified_at: '2026-10-22T12:00:00.000Z',
    aliases: ['ISM'],
  }],
};

const opaqueRouteShapeSentinel = { privateShape: 'must remain unused' };
const rowWithOpaqueRouteShape: PublishedNetworkRow = {
  ...rowWithoutRouteShape,
  route_shape: opaqueRouteShapeSentinel,
};

async function loadSnapshot(row: PublishedNetworkRow) {
  const query = vi.fn<PublishedNetworkQuery>().mockResolvedValue([row]);
  const reader = createPublishedNetworkReader({ connectionString: 'fixture-only', query });
  return reader.load();
}

describe('published route shape contract', () => {
  it('accepts a published direction row when route_shape is absent', async () => {
    const snapshot = await loadSnapshot(rowWithoutRouteShape);

    expect(snapshot.directions).toHaveLength(1);
    expect(snapshot).not.toHaveProperty('route_shape');
    expect(snapshot).not.toHaveProperty('routeShape');
  });

  it('keeps opaque route_shape values unused and out of the mapped result', async () => {
    const withoutShape = await loadSnapshot(rowWithoutRouteShape);
    const withShape = await loadSnapshot(rowWithOpaqueRouteShape);

    expect(withShape).toEqual(withoutShape);
    expect(JSON.stringify(withShape)).not.toContain('must remain unused');
  });
});
