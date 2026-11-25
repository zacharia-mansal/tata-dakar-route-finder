-- migrate:up
create view public.published_transit_network_by_network
with (security_barrier = true, security_invoker = false)
as
select
  published.line_id,
  published.line_number,
  published.direction_id,
  published.direction_name,
  published.displayed_destination_label,
  published.receiver_question,
  published.verified_at,
  coalesce((
    select jsonb_agg(
      stop.value || jsonb_build_object(
        'network', stops.network,
        'qualityStatus', stops.quality_status,
        'source', stops.source_code,
        'sourceReference', stops.source_reference
      ) order by stop.ordinality
    )
    from jsonb_array_elements(published.stops) with ordinality as stop(value, ordinality)
    join public.transit_stops stops on stops.id::text = stop.value ->> 'id'
    where stops.network = lines.network
      and stops.quality_status = 'confirmed'
  ), '[]'::jsonb) as stops,
  served_places.served_places,
  published.route_shape,
  lines.network,
  networks.display_name as network_name,
  lines.quality_status as line_quality_status,
  lines.source_code as line_source,
  lines.source_reference as line_source_reference
from public.published_transit_network published
join public.transit_lines lines on lines.id = published.line_id
join public.transit_networks networks on networks.network = lines.network
cross join lateral (
  select coalesce(jsonb_agg(place.value order by place.ordinality), '[]'::jsonb) as served_places
  from jsonb_array_elements(published.served_places) with ordinality as place(value, ordinality)
  join public.direction_stops direction_stops
    on direction_stops.direction_id = published.direction_id
    and direction_stops.stop_id::text = place.value ->> 'alighting_stop_id'
  join public.transit_stops alighting_stop
    on alighting_stop.id = direction_stops.stop_id
    and alighting_stop.network = lines.network
  where direction_stops.network = lines.network
    and direction_stops.status = 'published'
    and direction_stops.verified_at is not null
    and alighting_stop.status = 'published'
    and alighting_stop.verified_at is not null
    and alighting_stop.quality_status = 'confirmed'
) served_places
where lines.quality_status = 'confirmed'
  and jsonb_array_length(served_places.served_places) > 0
  and (
    select count(*)
    from jsonb_array_elements(published.stops) with ordinality as stop(value, ordinality)
    join public.transit_stops stops on stops.id::text = stop.value ->> 'id'
    where stops.network = lines.network
      and stops.quality_status = 'confirmed'
  ) >= 2;

comment on view public.published_transit_network_by_network is
  'Published transit routes with explicit network identity; incomplete and unconfirmed lines are excluded.';

create view public.contribution_incomplete_stops
with (security_barrier = true, security_invoker = false)
as
select id, network, quality_status, source_code, source_reference, name
from public.transit_stops
where quality_status = 'incomplete'
  and network in ('aftu_dakar', 'tata_thies');

comment on view public.contribution_incomplete_stops is
  'Minimal read-only contribution queue. Exposes only explicitly incomplete stops and no coordinates.';

revoke all privileges on table public.published_transit_network_by_network
from public, tata_catalog_reader;
revoke all privileges on table public.contribution_incomplete_stops
from public, tata_catalog_reader;
grant select on table public.published_transit_network_by_network to tata_catalog_reader;
grant select on table public.contribution_incomplete_stops to tata_catalog_reader;

-- migrate:down
revoke all privileges on table public.published_transit_network_by_network
from public, tata_catalog_reader;
revoke all privileges on table public.contribution_incomplete_stops
from public, tata_catalog_reader;
drop view if exists public.published_transit_network_by_network;
drop view if exists public.contribution_incomplete_stops;
