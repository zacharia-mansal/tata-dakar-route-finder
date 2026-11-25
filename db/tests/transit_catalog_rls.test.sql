begin;

create extension if not exists pgtap with schema public;
set local search_path to public, extensions;
select public.plan(27);

-- Temporary test access; the final ROLLBACK removes this membership grant.
grant tata_catalog_reader to current_user;

insert into public.verification_sources (
  id, claim_type, source_label, source_reference, reviewed_by, verified_at
) values
  ('10000000-0000-0000-0000-000000000001', 'pilot_area', 'Field boundary', 'pilot-area-review-1', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000002', 'transit_line', 'AFTU route sheet', 'aftu-line-24', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000003', 'place', 'Field location', 'place-ism-visit', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000004', 'place_alias', 'Local name check', 'place-ism-alias-check', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000005', 'transit_stop', 'Field stop check', 'stop-castor', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000006', 'transit_stop', 'Field stop check', 'stop-universite', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000007', 'line_direction', 'Field direction check', 'line-24-direction', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000008', 'receiver_question', 'Receiver wording check', 'line-24-question', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000009', 'direction_stop_order', 'Ordered field survey', 'line-24-stops', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000010', 'direction_stop_order', 'Ordered field survey', 'line-24-stops', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000011', 'served_place', 'Alighting point check', 'line-24-ism', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000012', 'line_direction', 'Field direction check', 'line-24-return-direction', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000013', 'receiver_question', 'Receiver wording check', 'line-24-return-question', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000014', 'direction_stop_order', 'Ordered field survey', 'line-24-return-stops', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000015', 'direction_stop_order', 'Ordered field survey', 'line-24-return-stops', 'reviewer', now()),
  ('10000000-0000-0000-0000-000000000016', 'served_place', 'Alighting point check', 'line-24-return-place', 'reviewer', now());

insert into public.pilot_areas (
  id, slug, name, coverage_area, status, verification_source_id, verified_at
) values (
  '20000000-0000-0000-0000-000000000001', 'sicap', 'SICAP',
  extensions.st_multi(extensions.st_geomfromtext('POLYGON((-17.47 14.68,-17.44 14.68,-17.44 14.72,-17.47 14.72,-17.47 14.68))', 4326)),
  'published', '10000000-0000-0000-0000-000000000001', now()
);

insert into public.places (
  id, pilot_area_id, display_name, area_name, location, status, verification_source_id, verified_at
) values (
  '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  'Institut Supérieur de Management', 'Université',
  extensions.st_setsrid(extensions.st_makepoint(-17.463, 14.693), 4326)::extensions.geography,
  'published', '10000000-0000-0000-0000-000000000003', now()
);

insert into public.place_aliases (
  id, place_id, alias, status, verification_source_id, verified_at
) values (
  '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
  'ISM', 'published', '10000000-0000-0000-0000-000000000004', now()
);

insert into public.transit_lines (
  id, network, line_number, status, verification_source_id, verified_at
) values
  ('50000000-0000-0000-0000-000000000001', 'aftu_dakar', '24', 'published', '10000000-0000-0000-0000-000000000002', now()),
  ('50000000-0000-0000-0000-000000000002', 'legacy_unclassified', 'draft', 'draft', null, null),
  ('50000000-0000-0000-0000-000000000003', 'legacy_unclassified', 'pending', 'candidate', null, null),
  ('50000000-0000-0000-0000-000000000004', 'legacy_unclassified', 'rejected', 'rejected', null, null);

select public.lives_ok(
  $$insert into public.transit_lines (id, network, line_number, status, quality_status)
    values ('50000000-0000-0000-0000-000000000005', 'tata_thies', '24', 'candidate', 'incomplete')$$,
  'the same line number can exist in a different network'
);
select public.throws_ok(
  $$insert into public.transit_lines (id, network, line_number, status)
    values ('50000000-0000-0000-0000-000000000006', 'aftu_dakar', '24', 'candidate')$$,
  '23505',
  null,
  'a duplicate line number is rejected inside the same network'
);

insert into public.transit_stops (
  id, network, name, location, status, verification_source_id, verified_at, quality_status
) values
  ('60000000-0000-0000-0000-000000000001', 'aftu_dakar', 'Castor', extensions.st_setsrid(extensions.st_makepoint(-17.451, 14.707), 4326)::extensions.geography, 'published', '10000000-0000-0000-0000-000000000005', now(), 'confirmed'),
  ('60000000-0000-0000-0000-000000000002', 'aftu_dakar', 'Université', extensions.st_setsrid(extensions.st_makepoint(-17.463, 14.693), 4326)::extensions.geography, 'published', '10000000-0000-0000-0000-000000000006', now(), 'confirmed'),
  ('60000000-0000-0000-0000-000000000003', 'aftu_dakar', null, null, 'candidate', null, null, 'incomplete');

select public.ok(
  exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'postgis'
      and n.nspname = 'extensions'
  ),
  'PostGIS extension objects are installed in the extensions schema'
);
select public.ok(
  extensions.st_srid(extensions.st_setsrid(extensions.st_makepoint(-17.45, 14.7), 4326)) = 4326
    and extensions.st_x(extensions.st_setsrid(extensions.st_makepoint(-17.45, 14.7), 4326)) = -17.45
    and extensions.st_y(extensions.st_setsrid(extensions.st_makepoint(-17.45, 14.7), 4326)) = 14.7,
  'PostGIS functions and geometry types work from the published-view search path'
);
select public.ok(
  exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'geometry'
      and n.nspname = 'extensions'
  )
    and exists (
      select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where t.typname = 'geography'
        and n.nspname = 'extensions'
    ),
  'PostGIS geometry and geography types are installed in extensions'
);
select public.ok(
  pg_typeof(extensions.st_setsrid(extensions.st_makepoint(-17.45, 14.7), 4326)) = 'extensions.geometry'::regtype
    and pg_typeof(extensions.st_setsrid(extensions.st_makepoint(-17.45, 14.7), 4326)::extensions.geography) = 'extensions.geography'::regtype
    and extensions.st_astext(extensions.st_setsrid(extensions.st_makepoint(-17.45, 14.7), 4326)::extensions.geometry) = 'POINT(-17.45 14.7)',
  'schema-qualified extensions.geometry and extensions.geography values are usable'
);

insert into public.line_directions (
  id, line_id, network, direction_name, displayed_destination_label, receiver_question,
  status, verification_source_id, verified_at, receiver_question_source_id,
  receiver_question_verified_at
) values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'aftu_dakar', 'Castor vers Université', 'Université', 'Est-ce que vous allez vers l’Université ?', 'published', '10000000-0000-0000-0000-000000000007', now(), '10000000-0000-0000-0000-000000000008', now()),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'legacy_unclassified', 'Draft direction', 'Draft', null, 'draft', null, null, null, null),
  ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 'legacy_unclassified', 'Pending direction', 'Pending', null, 'candidate', null, null, null, null),
  ('70000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000004', 'legacy_unclassified', 'Rejected direction', 'Rejected', null, 'rejected', null, null, null, null),
  ('70000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000001', 'aftu_dakar', 'Université vers Castor', 'Castor', 'Est-ce que vous allez vers Castor ?', 'published', '10000000-0000-0000-0000-000000000012', now(), '10000000-0000-0000-0000-000000000013', now());

insert into public.direction_stops (
  id, direction_id, network, stop_id, stop_order, status, verification_source_id, verified_at
) values
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'aftu_dakar', '60000000-0000-0000-0000-000000000001', 1, 'published', '10000000-0000-0000-0000-000000000009', now()),
  ('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'aftu_dakar', '60000000-0000-0000-0000-000000000002', 2, 'published', '10000000-0000-0000-0000-000000000010', now()),
  ('80000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000001', 'aftu_dakar', '60000000-0000-0000-0000-000000000003', 3, 'candidate', null, null),
  ('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000005', 'aftu_dakar', '60000000-0000-0000-0000-000000000002', 1, 'published', '10000000-0000-0000-0000-000000000014', now()),
  ('80000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000005', 'aftu_dakar', '60000000-0000-0000-0000-000000000001', 2, 'published', '10000000-0000-0000-0000-000000000015', now());

insert into public.served_places (
  id, place_id, direction_id, alighting_stop_id, area_name, status, verification_source_id, verified_at
) values (
  '90000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002',
  'Université', 'published', '10000000-0000-0000-0000-000000000011', now()
), (
  '90000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000001',
  'Castor', 'published', '10000000-0000-0000-0000-000000000016', now()
);

select public.ok(
  has_table_privilege('tata_catalog_reader', 'public.published_transit_network', 'select')
    and has_table_privilege('tata_catalog_reader', 'public.published_transit_network_by_network', 'select')
    and has_table_privilege('tata_catalog_reader', 'public.contribution_incomplete_stops', 'select'),
  'the read-only API role can read the curated route and contribution views'
);
select public.ok(
  not has_table_privilege('tata_catalog_reader', 'public.line_directions', 'select'),
  'the API role cannot query catalog tables directly'
);
select public.ok(
  not has_table_privilege('tata_catalog_reader', 'public.line_directions', 'insert'),
  'the API role cannot insert catalog data'
);
select public.ok(
  not has_table_privilege('tata_catalog_reader', 'public.line_directions', 'update'),
  'the API role cannot update or publish catalog data'
);
select public.ok(
  has_table_privilege('tata_catalog_reader', 'public.published_transit_network', 'select')
    and has_table_privilege('tata_catalog_reader', 'public.published_transit_network_by_network', 'select')
    and not exists (
      select 1
      from (values
        ('public.pilot_areas'),
        ('public.places'),
        ('public.place_aliases'),
        ('public.transit_lines'),
        ('public.transit_networks'),
        ('public.transit_stops'),
        ('public.stop_aliases'),
        ('public.line_directions'),
        ('public.direction_stops'),
        ('public.served_places'),
        ('public.route_shapes'),
        ('public.verification_sources')
      ) as source_tables(relation_name)
      where has_table_privilege('tata_catalog_reader', source_tables.relation_name, 'select')
        or has_table_privilege('tata_catalog_reader', source_tables.relation_name, 'insert')
        or has_table_privilege('tata_catalog_reader', source_tables.relation_name, 'update')
        or has_table_privilege('tata_catalog_reader', source_tables.relation_name, 'delete')
        or has_table_privilege('tata_catalog_reader', source_tables.relation_name, 'truncate')
        or has_table_privilege('tata_catalog_reader', source_tables.relation_name, 'references')
        or has_table_privilege('tata_catalog_reader', source_tables.relation_name, 'trigger')
    )
    and not exists (
      select 1
      from pg_auth_members
      where member = (select oid from pg_roles where rolname = 'tata_catalog_reader')
    )
    and not exists (
      select 1
      from pg_roles
      where rolname = 'tata_catalog_reader'
        and (rolsuper or rolcanlogin or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
    ),
  'the non-login API role can read only the curated public surface'
);
select public.ok(
  not has_schema_privilege('tata_catalog_reader', 'public', 'create')
    and not has_database_privilege('tata_catalog_reader', current_database(), 'create')
    and not exists (
      select 1
      from pg_namespace
      where nspname = 'public'
        and nspowner = (select oid from pg_roles where rolname = 'tata_catalog_reader')
    )
    and not exists (
      select 1
      from pg_database
      where datname = current_database()
        and datdba = (select oid from pg_roles where rolname = 'tata_catalog_reader')
    ),
  'the API role neither owns nor can create schemas in the database'
);

set local role tata_catalog_reader;
select public.is(
  (select count(*)::integer from public.published_transit_network_by_network),
  2,
  'the API sees both complete published directions, not draft, pending, or rejected rows'
);
select public.is(
  (select count(*)::integer from public.published_transit_network_by_network where line_number = '24' and network = 'aftu_dakar'),
  2,
  'published route rows expose their network identity'
);
select public.is(
  (
    select count(*)::integer
    from public.published_transit_network_by_network
    where line_number = '24' and network = 'tata_thies'
  ),
  0,
  'incomplete lines are not available to route search'
);
select public.is(
  (select count(*)::integer from public.contribution_incomplete_stops where network = 'aftu_dakar'),
  1,
  'the contribution view lists only explicitly incomplete stops for the selected network'
);
select public.ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contribution_incomplete_stops'
      and column_name in ('location', 'coordinates')
  ),
  'the contribution view does not expose stop coordinates'
);
select public.is(
  (
    select count(*)::integer
    from public.published_transit_network_by_network
    where line_number in ('draft', 'pending', 'rejected')
  ),
  0,
  'the public reader cannot see draft, candidate, or rejected catalog lines'
);
select public.is(
  (
    select array_agg(stop.value ->> 'name' order by stop.ordinality)
    from public.published_transit_network_by_network network
    cross join lateral jsonb_array_elements(network.stops) with ordinality as stop(value, ordinality)
    where network.direction_name = 'Castor vers Université'
  ),
  array['Castor', 'Université']::text[],
  'published stops retain their reviewed direction order and omit incomplete stops'
);
select public.is(
  (select served_places -> 0 ->> 'display_name' from public.published_transit_network_by_network where direction_name = 'Castor vers Université'),
  'Institut Supérieur de Management',
  'the canonical destination remains distinct from the bus destination label'
);
select public.is(
  (select displayed_destination_label from public.published_transit_network_by_network where direction_name = 'Castor vers Université'),
  'Université',
  'the bus destination label uses the verified local direction label'
);
select public.is(
  (select served_places -> 0 -> 'aliases' ->> 0 from public.published_transit_network_by_network where direction_name = 'Castor vers Université'),
  'ISM',
  'published aliases remain attached to the canonical destination'
);
select public.is(
  (select receiver_question from public.published_transit_network_by_network where direction_name = 'Castor vers Université'),
  'Est-ce que vous allez vers l’Université ?',
  'the public direction includes its separately verified receiver wording'
);
select public.is(
  (
    select array_agg(stop.value ->> 'name' order by stop.ordinality)
    from public.published_transit_network_by_network network
    cross join lateral jsonb_array_elements(network.stops) with ordinality as stop(value, ordinality)
    where network.direction_name = 'Université vers Castor'
  ),
  array['Université', 'Castor']::text[],
  'the reverse direction keeps its own independently ordered stops'
);
select public.is(
  (select displayed_destination_label from public.published_transit_network_by_network where direction_name = 'Université vers Castor'),
  'Castor',
  'the reverse direction exposes its own verified bus destination label'
);
reset role;

select public.throws_ok(
  $$
    insert into public.line_directions (id, line_id, direction_name, displayed_destination_label, receiver_question, status)
    values ('70000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000001', 'Unverified', 'Université', ' ', 'published')
  $$,
  '23514',
  null,
  'a direction cannot be published without verified receiver wording and evidence'
);

set local role tata_catalog_reader;
select public.throws_ok(
  $$insert into public.line_directions (line_id, direction_name, displayed_destination_label) values ('50000000-0000-0000-0000-000000000001', 'Unauthorised', 'Université')$$,
  '42501',
  null,
  'the API role cannot write to the catalog'
);
reset role;

select * from public.finish();
rollback;
