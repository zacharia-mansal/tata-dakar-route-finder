export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CatalogueStatus = 'draft' | 'candidate' | 'incomplete' | 'verified' | 'published' | 'rejected';
export type TransitNetworkId = 'aftu_dakar' | 'tata_thies' | (string & {});
export type TransitQualityStatus = 'incomplete' | 'needs_verification' | 'confirmed';

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

interface VerifiedRow {
  id: string;
  status: CatalogueStatus;
  verification_source_id: string | null;
  verification_claim: string;
  verified_at: string | null;
}

interface VerificationSourceRow {
  id: string;
  claim_type: string;
  source_label: string;
  source_reference: string;
  source_url: string | null;
  reviewed_by: string;
  verified_at: string;
}

interface PilotAreaRow extends VerifiedRow {
  slug: string;
  name: string;
  coverage_area: unknown;
}

interface PlaceRow extends VerifiedRow {
  pilot_area_id: string | null;
  display_name: string;
  area_name: string;
  location: unknown;
}

interface AliasRow extends VerifiedRow {
  alias: string;
  place_id?: string;
  stop_id?: string;
}

interface TransitLineRow extends VerifiedRow {
  network: TransitNetworkId;
  line_number: string | null;
  name: string | null;
  source_code: string;
  source_reference: string;
  quality_status: TransitQualityStatus;
}

interface TransitStopRow extends VerifiedRow {
  network: TransitNetworkId;
  name: string | null;
  location: unknown | null;
  source_code: string;
  source_reference: string;
  quality_status: TransitQualityStatus;
}

interface LineDirectionRow extends VerifiedRow {
  line_id: string;
  network: TransitNetworkId;
  direction_name: string;
  displayed_destination_label: string;
  receiver_question: string | null;
  receiver_question_source_id: string | null;
  receiver_question_claim: string;
  receiver_question_verified_at: string | null;
}

interface DirectionStopRow extends VerifiedRow {
  direction_id: string;
  network: TransitNetworkId;
  stop_id: string;
  stop_order: number;
}

interface ServedPlaceRow extends VerifiedRow {
  place_id: string;
  direction_id: string;
  alighting_stop_id: string;
  area_name: string;
}

interface RouteShapeRow extends VerifiedRow {
  direction_id: string;
  shape: unknown;
}

interface PublishedDirectionRow {
  line_id: string;
  line_number: string;
  direction_id: string;
  direction_name: string;
  displayed_destination_label: string;
  receiver_question: string;
  verified_at: string;
  stops: Json;
  served_places: Json;
  route_shape: Json | null;
  network: TransitNetworkId;
  network_name: string;
  line_quality_status: TransitQualityStatus;
  line_source: string;
  line_source_reference: string;
}

/** PostgreSQL schema types for the read-only published catalog surface. */
export interface Database {
  public: {
    Tables: {
      pilot_areas: Table<PilotAreaRow>;
      places: Table<PlaceRow>;
      place_aliases: Table<AliasRow>;
      transit_lines: Table<TransitLineRow>;
      transit_networks: Table<{ network: TransitNetworkId; display_name: string }>;
      transit_stops: Table<TransitStopRow>;
      stop_aliases: Table<AliasRow>;
      line_directions: Table<LineDirectionRow>;
      direction_stops: Table<DirectionStopRow>;
      served_places: Table<ServedPlaceRow>;
      route_shapes: Table<RouteShapeRow>;
      verification_sources: Table<VerificationSourceRow>;
    };
    Views: {
      published_transit_network: {
        Row: PublishedDirectionRow;
        Relationships: [];
      };
      published_transit_network_by_network: {
        Row: PublishedDirectionRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      catalogue_status: CatalogueStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
