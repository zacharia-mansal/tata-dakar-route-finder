-- migrate:up
create table public.transit_networks (
  network text primary key check (length(btrim(network)) > 0),
  display_name text not null check (length(btrim(display_name)) > 0)
);

insert into public.transit_networks (network, display_name) values
  ('aftu_dakar', 'AFTU Dakar'),
  ('tata_thies', 'Tata Thiès'),
  ('legacy_unclassified', 'Réseau historique non classé');

alter table public.transit_lines
  add column network text not null default 'legacy_unclassified',
  add column source_code text not null default 'legacy_unattributed'
    check (length(btrim(source_code)) > 0),
  add column source_reference text not null default 'legacy_unattributed'
    check (length(btrim(source_reference)) > 0),
  add column quality_status text not null default 'needs_verification'
    check (quality_status in ('incomplete', 'needs_verification', 'confirmed'));

alter table public.transit_lines
  add constraint transit_lines_network_fk
    foreign key (network) references public.transit_networks (network),
  drop constraint transit_lines_line_number_key,
  add constraint transit_lines_network_line_number_unique unique (network, line_number),
  add constraint transit_lines_incomplete_identity_check
    check (
      quality_status = 'incomplete'
      or (line_number is not null and length(btrim(line_number)) > 0)
    ),
  add constraint transit_lines_incomplete_not_published_check
    check (quality_status <> 'incomplete' or status not in ('verified', 'published'));

alter table public.transit_lines alter column line_number drop not null;

update public.transit_lines lines
set source_code = source.source_label,
    source_reference = source.source_reference
from public.verification_sources source
where source.id = lines.verification_source_id
  and source.claim_type = 'transit_line';

update public.transit_lines
set quality_status = 'confirmed'
where status in ('verified', 'published')
  and verification_source_id is not null
  and verified_at is not null;

alter table public.transit_lines
  add constraint transit_lines_quality_evidence_check
    check (quality_status <> 'confirmed' or (verification_source_id is not null and verified_at is not null)),
  add constraint transit_lines_published_quality_check
    check (status <> 'published' or quality_status = 'confirmed');

alter table public.transit_stops
  add column network text not null default 'legacy_unclassified',
  add column source_code text not null default 'legacy_unattributed'
    check (length(btrim(source_code)) > 0),
  add column source_reference text not null default 'legacy_unattributed'
    check (length(btrim(source_reference)) > 0),
  add column quality_status text not null default 'needs_verification'
    check (quality_status in ('incomplete', 'needs_verification', 'confirmed'));

alter table public.transit_stops
  alter column name drop not null,
  alter column location drop not null,
  add constraint transit_stops_network_fk
    foreign key (network) references public.transit_networks (network),
  add constraint transit_stops_incomplete_fields_check
    check (
      quality_status = 'incomplete'
      or (name is not null and length(btrim(name)) > 0 and location is not null)
    ),
  add constraint transit_stops_incomplete_not_published_check
    check (quality_status <> 'incomplete' or status not in ('verified', 'published'));

update public.transit_stops stops
set source_code = source.source_label,
    source_reference = source.source_reference
from public.verification_sources source
where source.id = stops.verification_source_id
  and source.claim_type = 'transit_stop';

update public.transit_stops
set quality_status = 'confirmed'
where status in ('verified', 'published')
  and verification_source_id is not null
  and verified_at is not null;

alter table public.transit_stops
  add constraint transit_stops_quality_evidence_check
    check (quality_status <> 'confirmed' or (verification_source_id is not null and verified_at is not null)),
  add constraint transit_stops_published_quality_check
    check (status <> 'published' or quality_status = 'confirmed');

alter table public.transit_lines
  add constraint transit_lines_id_network_unique unique (id, network);
alter table public.transit_stops
  add constraint transit_stops_id_network_unique unique (id, network);

alter table public.line_directions
  add column network text not null default 'legacy_unclassified';

update public.line_directions directions
set network = lines.network
from public.transit_lines lines
where lines.id = directions.line_id;

do $$
begin
  if exists (
    select stops.stop_id
    from public.direction_stops stops
    join public.line_directions directions on directions.id = stops.direction_id
    group by stops.stop_id
    having count(distinct directions.network) > 1
  ) then
    raise exception 'A legacy stop is attached to multiple networks; split or review those stop records before applying network scope';
  end if;
end
$$;

update public.transit_stops stops
set network = directions.network
from public.direction_stops direction_stops
join public.line_directions directions on directions.id = direction_stops.direction_id
where stops.id = direction_stops.stop_id;

alter table public.line_directions
  drop constraint line_directions_line_id_fkey,
  add constraint line_directions_line_network_fk
    foreign key (line_id, network) references public.transit_lines (id, network),
  add constraint line_directions_id_network_unique unique (id, network);

alter table public.direction_stops
  add column network text not null default 'legacy_unclassified';
update public.direction_stops direction_stops
set network = directions.network
from public.line_directions directions
where directions.id = direction_stops.direction_id;
alter table public.direction_stops
  drop constraint direction_stops_direction_id_fkey,
  drop constraint direction_stops_stop_id_fkey,
  add constraint direction_stops_direction_network_fk
    foreign key (direction_id, network) references public.line_directions (id, network) on delete cascade,
  add constraint direction_stops_stop_network_fk
    foreign key (stop_id, network) references public.transit_stops (id, network) on delete restrict,
  add constraint direction_stops_network_order_unique unique (direction_id, network, stop_order),
  add constraint direction_stops_network_stop_unique unique (direction_id, network, stop_id);

alter table public.transit_networks enable row level security;
revoke all privileges on table public.transit_networks from public, tata_catalog_reader;

-- migrate:down
do $$
begin
  if exists (
    select 1 from public.transit_lines where line_number is null
  ) or exists (
    select 1 from public.transit_lines group by line_number having count(*) > 1
  ) then
    raise exception 'Cannot roll back network scope while line numbers are incomplete or duplicated across networks';
  end if;
  if exists (
    select 1 from public.transit_stops where name is null or location is null
  ) then
    raise exception 'Cannot roll back network scope while incomplete stops lack names or coordinates';
  end if;
end
$$;

alter table public.direction_stops
  drop constraint direction_stops_direction_network_fk,
  drop constraint direction_stops_stop_network_fk,
  drop constraint direction_stops_network_order_unique,
  drop constraint direction_stops_network_stop_unique,
  add constraint direction_stops_direction_id_fkey
    foreign key (direction_id) references public.line_directions (id) on delete cascade,
  add constraint direction_stops_stop_id_fkey
    foreign key (stop_id) references public.transit_stops (id) on delete restrict;
alter table public.direction_stops drop column network;

alter table public.line_directions
  drop constraint line_directions_line_network_fk,
  drop constraint line_directions_id_network_unique,
  add constraint line_directions_line_id_fkey
    foreign key (line_id) references public.transit_lines (id) on delete cascade;
alter table public.line_directions drop column network;

alter table public.transit_stops
  drop constraint transit_stops_id_network_unique,
  drop constraint transit_stops_network_fk,
  drop constraint transit_stops_incomplete_fields_check,
  drop constraint transit_stops_incomplete_not_published_check,
  drop constraint transit_stops_quality_evidence_check,
  drop constraint transit_stops_published_quality_check,
  alter column name set not null,
  alter column location set not null;
alter table public.transit_stops drop column quality_status, drop column source_reference, drop column source_code, drop column network;

alter table public.transit_lines
  drop constraint transit_lines_id_network_unique,
  drop constraint transit_lines_network_fk,
  drop constraint transit_lines_incomplete_identity_check,
  drop constraint transit_lines_incomplete_not_published_check,
  drop constraint transit_lines_quality_evidence_check,
  drop constraint transit_lines_published_quality_check,
  alter column line_number set not null,
  add constraint transit_lines_line_number_key unique (line_number);
alter table public.transit_lines drop column quality_status, drop column source_reference, drop column source_code, drop column network;

drop table if exists public.transit_networks;
