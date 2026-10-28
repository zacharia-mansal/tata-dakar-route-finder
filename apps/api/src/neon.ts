import { neon } from '@neondatabase/serverless';
import type { Coordinates } from '../../../packages/domain/src/map';
import type { ServedPlace, TransitNetwork } from '../../../packages/domain/src/journey';
import type { TransitDirection, TransitStop } from '../../../packages/domain/src/transit';
import type { PlaceCandidate } from '../../../packages/domain/src/place';

export const publishedNetworkSql = [
  'select line_id, line_number, direction_id, direction_name,',
  'displayed_destination_label, receiver_question, verified_at,',
  'stops, served_places, route_shape',
  'from public.published_transit_network',
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
  route_shape: unknown;
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

function mapPublishedNetworkRows(rows: unknown[]): PublishedTransitNetworkSnapshot {
  const typedRows = rows as PublishedNetworkRow[];
  const directions: TransitDirection[] = typedRows.map((row) => ({
    id: row.direction_id,
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

/** Reads only the published, schema-qualified network view through Neon HTTP. */
export function createPublishedNetworkReader(options: {
  connectionString?: string;
  query?: PublishedNetworkQuery;
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

  return {
    async load(options: { signal?: AbortSignal } = {}): Promise<PublishedTransitNetworkSnapshot> {
      try {
        const rows = await query(publishedNetworkSql, [], {
          fetchOptions: options.signal ? { signal: options.signal } : undefined,
        });
        return mapPublishedNetworkRows(rows);
      } catch {
        throw new Error('Unable to load published transit network');
      }
    },
  };
}



