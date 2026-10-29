import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublishedNetworkReader, type PublishedNetworkQuery } from './neon';

const validRow = {
  line_id: 'line-24',
  line_number: '24',
  direction_id: 'direction-24-out',
  direction_name: 'Castor vers Université',
  displayed_destination_label: 'Université',
  receiver_question: 'Est-ce que ça va vers l’Université ?',
  verified_at: '2026-10-22T12:00:00.000Z',
  stops: [{
    id: 'castor-stop',
    name: 'Castor',
    coordinates: { lat: 14.707, lon: -17.451 },
    aliases: [],
  }, {
    id: 'university-stop',
    name: 'Université',
    coordinates: { lat: 14.69, lon: -17.44 },
    aliases: ['Campus universitaire'],
  }],
  served_places: [{
    place_id: 'ism',
    display_name: 'Institut Supérieur de Management',
    area_name: 'Université',
    coordinates: { lat: 14.691, lon: -17.441 },
    alighting_stop_id: 'university-stop',
    verified_at: '2026-10-22T12:00:00.000Z',
    aliases: ['ISM'],
  }],
  route_shape: { type: 'FeatureCollection', features: ['opaque fixture'] },
};

interface MutablePublishedRowFixture {
  line_id: unknown;
  line_number: unknown;
  direction_id: unknown;
  direction_name: unknown;
  displayed_destination_label: unknown;
  receiver_question: unknown;
  verified_at: unknown;
  stops: unknown;
  served_places: unknown;
  route_shape: unknown;
}

function rowWith(change: (row: MutablePublishedRowFixture) => void): unknown[] {
  const row: MutablePublishedRowFixture = structuredClone(validRow);
  change(row);
  return [row];
}

function readerFor(rows: unknown[]) {
  const query = vi.fn<PublishedNetworkQuery>().mockResolvedValue(rows);
  return createPublishedNetworkReader({ connectionString: 'fixture-only', query });
}

const topLevelMalformedCases: Array<{ name: string; change: (row: MutablePublishedRowFixture) => void }> = [
  { name: 'line_id has a non-text type', change: (row) => { row.line_id = 24; } },
  { name: 'line_number is empty text', change: (row) => { row.line_number = '  '; } },
  { name: 'direction_id has a non-text type', change: (row) => { row.direction_id = null; } },
  { name: 'direction_name is empty text', change: (row) => { row.direction_name = ''; } },
  { name: 'displayed destination has a non-text type', change: (row) => { row.displayed_destination_label = false; } },
  { name: 'receiver question is empty text', change: (row) => { row.receiver_question = ' '; } },
  { name: 'verification date is invalid', change: (row) => { row.verified_at = 'not-a-date'; } },
  { name: 'stops is not an array', change: (row) => { row.stops = {}; } },
  { name: 'a returned direction has fewer than two stops', change: (row) => { row.stops = [((row.stops as unknown[])[0])]; } },
  { name: 'served_places is not an array', change: (row) => { row.served_places = 'not-an-array'; } },
  { name: 'a returned direction has no served places', change: (row) => { row.served_places = []; } },
];

const nestedMalformedCases: Array<{ name: string; change: (row: MutablePublishedRowFixture) => void }> = [
  { name: 'a stop is not an object', change: (row) => { row.stops = [null]; } },
  { name: 'a stop id has a non-text type', change: (row) => { (row.stops as Array<Record<string, unknown>>)[0].id = 7; } },
  { name: 'a stop name is empty text', change: (row) => { (row.stops as Array<Record<string, unknown>>)[0].name = ''; } },
  { name: 'stop aliases are not a string array', change: (row) => { (row.stops as Array<Record<string, unknown>>)[0].aliases = ['valid', 8]; } },
  { name: 'a served place is not an object', change: (row) => { row.served_places = [null]; } },
  { name: 'a served-place id has a non-text type', change: (row) => { (row.served_places as Array<Record<string, unknown>>)[0].place_id = 12; } },
  { name: 'a served-place display name is empty text', change: (row) => { (row.served_places as Array<Record<string, unknown>>)[0].display_name = ' '; } },
  { name: 'a served-place area is not text', change: (row) => { (row.served_places as Array<Record<string, unknown>>)[0].area_name = {}; } },
  { name: 'a served-place alighting stop id is empty text', change: (row) => { (row.served_places as Array<Record<string, unknown>>)[0].alighting_stop_id = ''; } },
  { name: 'a served-place verification date is invalid', change: (row) => { (row.served_places as Array<Record<string, unknown>>)[0].verified_at = 'yesterday'; } },
  { name: 'served-place aliases contain a non-text value', change: (row) => { (row.served_places as Array<Record<string, unknown>>)[0].aliases = [false]; } },
];

const invalidCoordinates: Array<{ name: string; coordinates: unknown }> = [
  { name: 'non-numeric latitude', coordinates: { lat: '14.69', lon: -17.44 } },
  { name: 'non-numeric longitude', coordinates: { lat: 14.69, lon: '-17.44' } },
  { name: 'NaN latitude', coordinates: { lat: Number.NaN, lon: -17.44 } },
  { name: 'infinite latitude', coordinates: { lat: Number.POSITIVE_INFINITY, lon: -17.44 } },
  { name: 'infinite longitude', coordinates: { lat: 14.69, lon: Number.NEGATIVE_INFINITY } },
  { name: 'latitude above the legal range', coordinates: { lat: 90.0001, lon: -17.44 } },
  { name: 'latitude below the legal range', coordinates: { lat: -90.0001, lon: -17.44 } },
  { name: 'longitude above the legal range', coordinates: { lat: 14.69, lon: 180.0001 } },
  { name: 'longitude below the legal range', coordinates: { lat: 14.69, lon: -180.0001 } },
];

afterEach(() => vi.restoreAllMocks());

describe('Neon published-view runtime row validation', () => {
  it.each(topLevelMalformedCases)('rejects a row when $name', async ({ change }) => {
    await expect(readerFor(rowWith(change)).load()).rejects.toThrow('Unable to load published transit network');
  });

  it.each(nestedMalformedCases)('rejects a row when $name', async ({ change }) => {
    await expect(readerFor(rowWith(change)).load()).rejects.toThrow('Unable to load published transit network');
  });

  it.each(invalidCoordinates)('rejects invalid stop coordinates: $name', async ({ coordinates }) => {
    const rows = rowWith((row) => {
      (row.stops as Array<Record<string, unknown>>)[0].coordinates = coordinates;
    });

    await expect(readerFor(rows).load()).rejects.toThrow('Unable to load published transit network');
  });

  it.each(invalidCoordinates)('rejects invalid served-place coordinates: $name', async ({ coordinates }) => {
    const rows = rowWith((row) => {
      (row.served_places as Array<Record<string, unknown>>)[0].coordinates = coordinates;
    });

    await expect(readerFor(rows).load()).rejects.toThrow('Unable to load published transit network');
  });

  it('rejects malformed top-level result entries without exposing their values', async () => {
    await expect(readerFor([null]).load()).rejects.toThrow('Unable to load published transit network');
  });

  it('accepts legal world coordinate bounds without applying the Dakar geocoder box', async () => {
    const rows = rowWith((row) => {
      (row.stops as Array<Record<string, unknown>>)[0].coordinates = { lat: 90, lon: 180 };
      (row.served_places as Array<Record<string, unknown>>)[0].coordinates = { lat: -90, lon: -180 };
    });

    await expect(readerFor(rows).load()).resolves.toMatchObject({
      stops: [
        { coordinates: { lat: 90, lon: 180 } },
        { coordinates: expect.any(Object) },
      ],
      servedPlaces: [{ coordinates: { lat: -90, lon: -180 } }],
    });
  });

  it('returns only the generic error for a malformed sentinel row and writes no logs', async () => {
    const sentinel = 'MALFORMED_ROW_SENTINEL_PRIVATE_DETAIL';
    const rows = rowWith((row) => {
      row.line_id = sentinel;
      row.stops = null;
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    let failure: unknown;
    try {
      await readerFor(rows).load();
    } catch (caught) {
      failure = caught;
    }

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('Unable to load published transit network');
    expect((failure as Error).message).not.toContain(sentinel);
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
