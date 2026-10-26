-- migrate:up
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'postgis'
      and n.nspname = 'extensions'
  ) then
    raise exception 'PostGIS must be installed in the extensions schema';
  end if;
end
$$;

create type public.catalogue_status as enum (
  'draft',
  'candidate',
  'verified',
  'published',
  'rejected'
);

create type public.verification_claim as enum (
  'pilot_area',
  'place',
  'place_alias',
  'transit_line',
  'transit_stop',
  'stop_alias',
  'line_direction',
  'receiver_question',
  'direction_stop_order',
  'served_place',
  'route_shape'
);

create table public.verification_sources (
  id uuid primary key default gen_random_uuid(),
  claim_type public.verification_claim not null,
  source_label text not null check (length(btrim(source_label)) > 0),
  source_reference text not null check (length(btrim(source_reference)) > 0),
  source_url text,
  reviewed_by text not null check (length(btrim(reviewed_by)) > 0),
  verified_at timestamptz not null,
  unique (id, claim_type)
);

create table public.pilot_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(btrim(slug)) > 0),
  name text not null check (length(btrim(name)) > 0),
  coverage_area extensions.geometry(MultiPolygon, 4326) not null,
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'pilot_area'
    check (verification_claim = 'pilot_area'),
  verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  check (extensions.st_isvalid(coverage_area)),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  pilot_area_id uuid references public.pilot_areas (id) on delete set null,
  display_name text not null check (length(btrim(display_name)) > 0),
  area_name text not null check (length(btrim(area_name)) > 0),
  location extensions.geography(Point, 4326) not null,
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'place'
    check (verification_claim = 'place'),
  verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create table public.place_aliases (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  alias text not null check (length(btrim(alias)) > 0),
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'place_alias'
    check (verification_claim = 'place_alias'),
  verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create table public.transit_lines (
  id uuid primary key default gen_random_uuid(),
  line_number text not null check (length(btrim(line_number)) > 0),
  name text,
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'transit_line'
    check (verification_claim = 'transit_line'),
  verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  unique (line_number),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create table public.transit_stops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  location extensions.geography(Point, 4326) not null,
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'transit_stop'
    check (verification_claim = 'transit_stop'),
  verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create table public.stop_aliases (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references public.transit_stops (id) on delete cascade,
  alias text not null check (length(btrim(alias)) > 0),
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'stop_alias'
    check (verification_claim = 'stop_alias'),
  verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create table public.line_directions (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.transit_lines (id) on delete cascade,
  direction_name text not null check (length(btrim(direction_name)) > 0),
  displayed_destination_label text not null
    check (length(btrim(displayed_destination_label)) > 0),
  receiver_question text,
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'line_direction'
    check (verification_claim = 'line_direction'),
  verified_at timestamptz,
  receiver_question_source_id uuid,
  receiver_question_claim public.verification_claim not null default 'receiver_question'
    check (receiver_question_claim = 'receiver_question'),
  receiver_question_verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  foreign key (receiver_question_source_id, receiver_question_claim)
    references public.verification_sources (id, claim_type),
  unique (line_id, direction_name),
  check (
    status not in ('verified', 'published')
    or (
      verification_source_id is not null
      and verified_at is not null
      and receiver_question_source_id is not null
      and receiver_question_verified_at is not null
      and receiver_question is not null
      and length(btrim(receiver_question)) > 0
    )
  )
);

create table public.direction_stops (
  id uuid primary key default gen_random_uuid(),
  direction_id uuid not null references public.line_directions (id) on delete cascade,
  stop_id uuid not null references public.transit_stops (id) on delete restrict,
  stop_order integer not null check (stop_order > 0),
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'direction_stop_order'
    check (verification_claim = 'direction_stop_order'),
  verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  unique (direction_id, stop_order),
  unique (direction_id, stop_id),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create table public.served_places (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  direction_id uuid not null references public.line_directions (id) on delete cascade,
  alighting_stop_id uuid not null,
  area_name text not null check (length(btrim(area_name)) > 0),
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'served_place'
    check (verification_claim = 'served_place'),
  verified_at timestamptz,
  foreign key (direction_id, alighting_stop_id)
    references public.direction_stops (direction_id, stop_id) on delete restrict,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  unique (place_id, direction_id),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create table public.route_shapes (
  id uuid primary key default gen_random_uuid(),
  direction_id uuid not null unique references public.line_directions (id) on delete cascade,
  shape extensions.geometry(LineString, 4326) not null,
  status public.catalogue_status not null default 'draft',
  verification_source_id uuid,
  verification_claim public.verification_claim not null default 'route_shape'
    check (verification_claim = 'route_shape'),
  verified_at timestamptz,
  foreign key (verification_source_id, verification_claim)
    references public.verification_sources (id, claim_type),
  check (extensions.st_npoints(shape) >= 2),
  check (extensions.st_isvalid(shape)),
  check (
    status not in ('verified', 'published')
    or (verification_source_id is not null and verified_at is not null)
  )
);

create index pilot_areas_coverage_area_gist
  on public.pilot_areas using gist (coverage_area);
create index places_location_gist
  on public.places using gist (location);
create index transit_stops_location_gist
  on public.transit_stops using gist (location);
create index route_shapes_shape_gist
  on public.route_shapes using gist (shape);
create index direction_stops_direction_order_idx
  on public.direction_stops (direction_id, stop_order);
create unique index place_aliases_normalized_unique
  on public.place_aliases (place_id, lower(btrim(alias)));
create unique index stop_aliases_normalized_unique
  on public.stop_aliases (stop_id, lower(btrim(alias)));

-- migrate:down
drop table if exists public.route_shapes;
drop table if exists public.served_places;
drop table if exists public.direction_stops;
drop table if exists public.line_directions;
drop table if exists public.stop_aliases;
drop table if exists public.transit_stops;
drop table if exists public.transit_lines;
drop table if exists public.place_aliases;
drop table if exists public.places;
drop table if exists public.pilot_areas;
drop table if exists public.verification_sources;
drop type if exists public.verification_claim;
drop type if exists public.catalogue_status;
