-- migrate:up
do $$
declare
  has_unsafe_attributes boolean;
begin
  select rolsuper or rolcanlogin or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls
  into has_unsafe_attributes
  from pg_roles
  where rolname = 'tata_catalog_reader';

  if not found then
    execute 'create role tata_catalog_reader nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls';
  elsif has_unsafe_attributes then
    raise exception 'Existing role tata_catalog_reader has unsafe attributes; remove or correct it before applying migrations';
  end if;

  if exists (
    select 1
    from pg_auth_members
    where member = (select oid from pg_roles where rolname = 'tata_catalog_reader')
  ) then
    raise exception 'Existing role tata_catalog_reader inherits another role; remove its memberships before applying migrations';
  end if;

  if exists (
    select 1
    from pg_namespace
    where nspname = 'public'
      and nspowner = (select oid from pg_roles where rolname = 'tata_catalog_reader')
  ) or exists (
    select 1
    from pg_database
    where datname = current_database()
      and datdba = (select oid from pg_roles where rolname = 'tata_catalog_reader')
  ) then
    raise exception 'Existing role tata_catalog_reader owns the public schema or current database; transfer ownership before applying migrations';
  end if;

  execute format(
    'revoke create on database %I from tata_catalog_reader',
    current_database()
  );
end
$$;

revoke create on schema public from public, tata_catalog_reader;

alter table public.pilot_areas enable row level security;
alter table public.places enable row level security;
alter table public.place_aliases enable row level security;
alter table public.transit_lines enable row level security;
alter table public.transit_stops enable row level security;
alter table public.stop_aliases enable row level security;
alter table public.line_directions enable row level security;
alter table public.direction_stops enable row level security;
alter table public.served_places enable row level security;
alter table public.route_shapes enable row level security;
alter table public.verification_sources enable row level security;

-- The tables are deliberately not an app API surface. The curated view below
-- is the only read grant for the server-side API role; RLS also defaults to
-- deny on the underlying tables as a second boundary.
revoke all privileges on table
  public.pilot_areas,
  public.places,
  public.place_aliases,
  public.transit_lines,
  public.transit_stops,
  public.stop_aliases,
  public.line_directions,
  public.direction_stops,
  public.served_places,
  public.route_shapes,
  public.verification_sources
from public, tata_catalog_reader;

create view public.published_transit_network
with (security_barrier = true, security_invoker = false)
as
select
  l.id as line_id,
  l.line_number,
  d.id as direction_id,
  d.direction_name,
  d.displayed_destination_label,
  d.receiver_question,
  greatest(l.verified_at, d.verified_at, d.receiver_question_verified_at) as verified_at,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'coordinates', jsonb_build_object(
          'lat', extensions.st_y(s.location::extensions.geometry),
          'lon', extensions.st_x(s.location::extensions.geometry)
        ),
        'aliases', coalesce(stop_aliases.aliases, '[]'::jsonb)
      ) order by ds.stop_order
    )
    from public.direction_stops ds
    join public.transit_stops s on s.id = ds.stop_id
    join public.verification_sources ds_source
      on ds_source.id = ds.verification_source_id
      and ds_source.claim_type = 'direction_stop_order'
    join public.verification_sources stop_source
      on stop_source.id = s.verification_source_id
      and stop_source.claim_type = 'transit_stop'
    left join lateral (
      select jsonb_agg(sa.alias order by sa.alias) as aliases
      from public.stop_aliases sa
      join public.verification_sources sa_source
        on sa_source.id = sa.verification_source_id
        and sa_source.claim_type = 'stop_alias'
      where sa.stop_id = s.id
        and sa.status = 'published'
        and sa.verified_at is not null
    ) stop_aliases on true
    where ds.direction_id = d.id
      and ds.status = 'published'
      and ds.verified_at is not null
      and s.status = 'published'
      and s.verified_at is not null
  ), '[]'::jsonb) as stops,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'place_id', p.id,
        'display_name', p.display_name,
        'area_name', sp.area_name,
        'coordinates', jsonb_build_object(
          'lat', extensions.st_y(p.location::extensions.geometry),
          'lon', extensions.st_x(p.location::extensions.geometry)
        ),
        'alighting_stop_id', sp.alighting_stop_id,
        'verified_at', sp.verified_at,
        'aliases', coalesce(place_aliases.aliases, '[]'::jsonb)
      ) order by p.display_name
    )
    from public.served_places sp
    join public.places p on p.id = sp.place_id
    join public.direction_stops alighting
      on alighting.direction_id = sp.direction_id
      and alighting.stop_id = sp.alighting_stop_id
    join public.transit_stops alighting_stop
      on alighting_stop.id = alighting.stop_id
    join public.verification_sources served_source
      on served_source.id = sp.verification_source_id
      and served_source.claim_type = 'served_place'
    join public.verification_sources place_source
      on place_source.id = p.verification_source_id
      and place_source.claim_type = 'place'
    join public.verification_sources alighting_source
      on alighting_source.id = alighting.verification_source_id
      and alighting_source.claim_type = 'direction_stop_order'
    join public.verification_sources alighting_stop_source
      on alighting_stop_source.id = alighting_stop.verification_source_id
      and alighting_stop_source.claim_type = 'transit_stop'
    left join lateral (
      select jsonb_agg(pa.alias order by pa.alias) as aliases
      from public.place_aliases pa
      join public.verification_sources pa_source
        on pa_source.id = pa.verification_source_id
        and pa_source.claim_type = 'place_alias'
      where pa.place_id = p.id
        and pa.status = 'published'
        and pa.verified_at is not null
    ) place_aliases on true
    where sp.direction_id = d.id
      and sp.status = 'published'
      and sp.verified_at is not null
      and p.status = 'published'
      and p.verified_at is not null
      and alighting.status = 'published'
      and alighting.verified_at is not null
      and alighting_stop.status = 'published'
      and alighting_stop.verified_at is not null
  ), '[]'::jsonb) as served_places,
  (
    select extensions.st_asgeojson(rs.shape)::jsonb
    from public.route_shapes rs
    join public.verification_sources shape_source
      on shape_source.id = rs.verification_source_id
      and shape_source.claim_type = 'route_shape'
    where rs.direction_id = d.id
      and rs.status = 'published'
      and rs.verified_at is not null
  ) as route_shape
from public.transit_lines l
join public.line_directions d on d.line_id = l.id
join public.verification_sources line_source
  on line_source.id = l.verification_source_id
  and line_source.claim_type = 'transit_line'
join public.verification_sources direction_source
  on direction_source.id = d.verification_source_id
  and direction_source.claim_type = 'line_direction'
join public.verification_sources question_source
  on question_source.id = d.receiver_question_source_id
  and question_source.claim_type = 'receiver_question'
where l.status = 'published'
  and l.verified_at is not null
  and d.status = 'published'
  and d.verified_at is not null
  and d.receiver_question_verified_at is not null
  and d.receiver_question is not null
  and length(btrim(d.receiver_question)) > 0
  and (
    select count(*)
    from public.direction_stops ds
    join public.transit_stops s on s.id = ds.stop_id
    join public.verification_sources ds_source
      on ds_source.id = ds.verification_source_id
      and ds_source.claim_type = 'direction_stop_order'
    join public.verification_sources stop_source
      on stop_source.id = s.verification_source_id
      and stop_source.claim_type = 'transit_stop'
    where ds.direction_id = d.id
      and ds.status = 'published'
      and ds.verified_at is not null
      and s.status = 'published'
      and s.verified_at is not null
  ) >= 2
  and exists (
    select 1
    from public.served_places sp
    join public.places p on p.id = sp.place_id
    join public.direction_stops alighting
      on alighting.direction_id = sp.direction_id
      and alighting.stop_id = sp.alighting_stop_id
    join public.transit_stops alighting_stop
      on alighting_stop.id = alighting.stop_id
    join public.verification_sources served_source
      on served_source.id = sp.verification_source_id
      and served_source.claim_type = 'served_place'
    join public.verification_sources place_source
      on place_source.id = p.verification_source_id
      and place_source.claim_type = 'place'
    join public.verification_sources alighting_source
      on alighting_source.id = alighting.verification_source_id
      and alighting_source.claim_type = 'direction_stop_order'
    join public.verification_sources alighting_stop_source
      on alighting_stop_source.id = alighting_stop.verification_source_id
      and alighting_stop_source.claim_type = 'transit_stop'
    where sp.direction_id = d.id
      and sp.status = 'published'
      and sp.verified_at is not null
      and p.status = 'published'
      and p.verified_at is not null
      and alighting.status = 'published'
      and alighting.verified_at is not null
      and alighting_stop.status = 'published'
      and alighting_stop.verified_at is not null
  );

comment on view public.published_transit_network is
  'Curated read-only API surface. Base catalog tables and verification evidence remain inaccessible to app roles.';

revoke all privileges on table public.published_transit_network
from public, tata_catalog_reader;
grant usage on schema public to tata_catalog_reader;
grant select on table public.published_transit_network to tata_catalog_reader;

-- migrate:down
drop view if exists public.published_transit_network;
alter table public.pilot_areas disable row level security;
alter table public.places disable row level security;
alter table public.place_aliases disable row level security;
alter table public.transit_lines disable row level security;
alter table public.transit_stops disable row level security;
alter table public.stop_aliases disable row level security;
alter table public.line_directions disable row level security;
alter table public.direction_stops disable row level security;
alter table public.served_places disable row level security;
alter table public.route_shapes disable row level security;
alter table public.verification_sources disable row level security;
revoke all privileges on schema public from tata_catalog_reader;
do $$
begin
  execute format(
    'revoke create on database %I from tata_catalog_reader',
    current_database()
  );
end
$$;
-- Keep the group role so existing server login memberships remain valid.
-- With the view and schema grants removed, the role has no catalog access.
