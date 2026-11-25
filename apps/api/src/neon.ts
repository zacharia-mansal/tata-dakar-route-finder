import { neon } from '@neondatabase/serverless';
import type { Coordinates } from '../../../packages/domain/src/map';
import type { ServedPlace, TransitNetwork } from '../../../packages/domain/src/journey';
import type { NetworkId, TransitDirection, TransitStop } from '../../../packages/domain/src/transit';
import { validateTransitStopRecord, type TransitStopRecord } from '../../../packages/domain/src/transit';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import { withAbortTimeout } from './abort';

export const publishedNetworkSql = [
  'select line_id, line_number, direction_id, direction_name,',
  'displayed_destination_label, receiver_question, verified_at,',
  'stops, served_places, route_shape, network, network_name,',
  'line_quality_status, line_source, line_source_reference',
  'from public.published_transit_network_by_network',
].join(' ');

export const contributionStopsSql = [
  'select id::text as id, network, quality_status as "qualityStatus",',
  'source_code as source, source_reference as "sourceReference", name',
  'from public.contribution_incomplete_stops',
  'where network = $1',
  'order by id',
].join(' ');

interface PublishedServedPlaceRow {
  place_id: string;
  area_name: string;
  alighting_stop_id: string;
  verified_at: string;
  display_name: string;
  coordinates: Coordinates;
  aliases: string[];
}

export interface PublishedNetworkRow {
  line_id: string;
  line_number: string;
  direction_id: string;
  direction_name: string;
  displayed_destination_label: string;
  receiver_question: string;
  verified_at: string;
  stops: TransitStop[];
  served_places: PublishedServedPlaceRow[];
  route_shape?: unknown;
  network: NetworkId;
  network_name: string;
  line_quality_status: 'confirmed';
  line_source: string;
  line_source_reference: string;
}

export interface PublishedServedPlace extends ServedPlace, Pick<PlaceCandidate, 'displayName' | 'coordinates' | 'source'> {
  id: string;
  aliases: string[];
}

export type PublishedTransitNetworkSnapshot = Omit<TransitNetwork, 'servedPlaces'> & {
  servedPlaces: PublishedServedPlace[];
};

export interface NeonFetchOptions {
  fetchOptions?: { signal?: AbortSignal };
}

export type PublishedNetworkQuery = (
  sql: string,
  params?: unknown[],
  queryOptions?: NeonFetchOptions,
) => Promise<unknown[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDateText(value: unknown): value is string {
  return isNonEmptyText(value) && Number.isFinite(Date.parse(value));
}

function isCoordinatePair(value: unknown): value is Coordinates {
  if (!isRecord(value)) return false;
  const { lat, lon } = value;
  return (
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPublishedStop(value: unknown): value is TransitStop {
  return (
    isRecord(value) &&
    isNonEmptyText(value.id) &&
    isNonEmptyText(value.network) &&
    value.qualityStatus === 'confirmed' &&
    isNonEmptyText(value.source) &&
    isNonEmptyText(value.sourceReference) &&
    isNonEmptyText(value.name) &&
    isCoordinatePair(value.coordinates) &&
    isStringArray(value.aliases)
  );
}

function isPublishedServedPlace(value: unknown): value is PublishedServedPlaceRow {
  return (
    isRecord(value) &&
    isNonEmptyText(value.place_id) &&
    isNonEmptyText(value.display_name) &&
    isNonEmptyText(value.area_name) &&
    isNonEmptyText(value.alighting_stop_id) &&
    isValidDateText(value.verified_at) &&
    isCoordinatePair(value.coordinates) &&
    isStringArray(value.aliases)
  );
}

function isPublishedNetworkRow(value: unknown): value is PublishedNetworkRow {
  if (
    !isRecord(value) ||
    !isNonEmptyText(value.line_id) ||
    !isNonEmptyText(value.line_number) ||
    !isNonEmptyText(value.direction_id) ||
    !isNonEmptyText(value.direction_name) ||
    !isNonEmptyText(value.displayed_destination_label) ||
    !isNonEmptyText(value.receiver_question) ||
    !isNonEmptyText(value.network) ||
    !isNonEmptyText(value.network_name) ||
    value.line_quality_status !== 'confirmed' ||
    !isNonEmptyText(value.line_source) ||
    !isNonEmptyText(value.line_source_reference) ||
    !isValidDateText(value.verified_at) ||
    !Array.isArray(value.stops) || value.stops.length < 2 ||
    !Array.isArray(value.served_places) || value.served_places.length < 1
  ) {
    return false;
  }

  if (!value.stops.every(isPublishedStop)) return false;
  if (!value.stops.every((stop) => stop.network === value.network)) return false;
  const stopIds = new Set(value.stops.map((stop) => stop.id));
  if (stopIds.size !== value.stops.length) return false;
  if (!value.served_places.every(isPublishedServedPlace)) return false;

  return value.served_places.every((place) => stopIds.has(place.alighting_stop_id));
}

function validatePublishedNetworkRows(rows: unknown): PublishedNetworkRow[] {
  if (!Array.isArray(rows) || !rows.every(isPublishedNetworkRow)) {
    throw new Error('Invalid published network result');
  }
  return rows;
}

function mapServedPlace(row: PublishedServedPlaceRow, directionId: string): PublishedServedPlace {
  return {
    id: row.place_id,
    placeId: row.place_id,
    displayName: row.display_name,
    areaName: row.area_name,
    coordinates: row.coordinates,
    aliases: row.aliases,
    directionId,
    alightingStopId: row.alighting_stop_id,
    verifiedAt: row.verified_at,
    source: 'catalogue',
  };
}

function mapPublishedNetworkRows(rows: unknown): PublishedTransitNetworkSnapshot {
  const typedRows = validatePublishedNetworkRows(rows);
  const directions: TransitDirection[] = typedRows.map((row) => ({
    id: row.direction_id,
    network: row.network,
    networkName: row.network_name,
    qualityStatus: row.line_quality_status,
    source: row.line_source,
    lineNumber: row.line_number,
    directionName: row.direction_name,
    displayedDestinationLabel: row.displayed_destination_label,
    receiverQuestion: row.receiver_question,
    stops: row.stops,
  }));
  const stopsById = new Map<string, TransitStop>();
  for (const direction of directions) {
    for (const stop of direction.stops) stopsById.set(stop.id, stop);
  }
  return {
    directions,
    stops: [...stopsById.values()],
    servedPlaces: typedRows.flatMap((row) =>
      row.served_places.map((place) => mapServedPlace(place, row.direction_id)),
    ),
  };
}

/**
 * Reads only the published, schema-qualified network view through Neon HTTP.
 * Publication is guaranteed by the WHERE filters in
 * db/migrations/20261022000200_expose_verified_catalog.sql, not by runtime status fields.
 */
export function createPublishedNetworkReader(options: {
  connectionString?: string;
  query?: PublishedNetworkQuery;
  queryTimeoutMs?: number;
} = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL_PUBLIC_API;
  if (!connectionString?.trim()) {
    throw new Error('DATABASE_URL_PUBLIC_API is required');
  }

  let client: ReturnType<typeof neon> | undefined;
  if (!options.query) {
    try {
      client = neon(connectionString);
    } catch {
      throw new Error('Unable to initialize published network reader');
    }
  }
  const query: PublishedNetworkQuery = options.query ??
    ((sql, params, queryOptions) => client!.query(sql, params, queryOptions) as unknown as Promise<unknown[]>);
  const queryTimeoutMs = options.queryTimeoutMs ?? 4_000;

  return {
    async load(options: { signal?: AbortSignal } = {}): Promise<PublishedTransitNetworkSnapshot> {
      try {
        const rows = await withAbortTimeout(
          (signal) => query(publishedNetworkSql, [], { fetchOptions: { signal } }),
          queryTimeoutMs,
          `Published network query timeout after ${queryTimeoutMs} ms`,
          options.signal,
        );
        return mapPublishedNetworkRows(rows);
      } catch {
        throw new Error('Unable to load published transit network');
      }
    },
  };
}

/** Reads only records explicitly marked incomplete for the contribution queue. */
export function createContributionStopReader(options: {
  connectionString?: string;
  query?: PublishedNetworkQuery;
  queryTimeoutMs?: number;
} = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL_PUBLIC_API;
  if (!connectionString?.trim()) throw new Error('DATABASE_URL_PUBLIC_API is required');

  let client: ReturnType<typeof neon> | undefined;
  if (!options.query) {
    try {
      client = neon(connectionString);
    } catch {
      throw new Error('Unable to initialize contribution stop reader');
    }
  }
  const query: PublishedNetworkQuery = options.query ??
    ((sql, params, queryOptions) => client!.query(sql, params, queryOptions) as unknown as Promise<unknown[]>);
  const queryTimeoutMs = options.queryTimeoutMs ?? 4_000;

  return {
    async load(network: NetworkId, options: { signal?: AbortSignal } = {}): Promise<TransitStopRecord[]> {
      try {
        const rows = await withAbortTimeout(
          (signal) => query(contributionStopsSql, [network], { fetchOptions: { signal } }),
          queryTimeoutMs,
          `Contribution stop query timeout after ${queryTimeoutMs} ms`,
          options.signal,
        );
        if (!Array.isArray(rows)) throw new Error('Invalid contribution stops result');
        return rows.map(validateTransitStopRecord);
      } catch {
        throw new Error('Unable to load contribution stops');
      }
    },
  };
}



