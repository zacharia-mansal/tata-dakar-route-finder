export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CatalogueStatus = 'draft' | 'candidate' | 'verified' | 'published' | 'rejected';

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
  line_number: string;
  name: string | null;
}

interface TransitStopRow extends VerifiedRow {
  name: string;
  location: unknown;
}

interface LineDirectionRow extends VerifiedRow {
  line_id: string;
  direction_name: string;
  displayed_destination_label: string;
  receiver_question: string | null;
  receiver_question_source_id: string | null;
  receiver_question_claim: string;
  receiver_question_verified_at: string | null;
}

interface DirectionStopRow extends VerifiedRow {
  direction_id: string;
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
}

/** PostgreSQL schema types for the read-only published catalog surface. */
export interface Database {
  public: {
    Tables: {
      pilot_areas: Table<PilotAreaRow>;
      places: Table<PlaceRow>;
      place_aliases: Table<AliasRow>;
      transit_lines: Table<TransitLineRow>;
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
    };
    Functions: Record<string, never>;
    Enums: {
      catalogue_status: CatalogueStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
