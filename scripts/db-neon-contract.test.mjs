import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const catalogMigration = readFileSync(
  new URL('../db/migrations/20261022000100_create_transit_catalog.sql', import.meta.url),
  'utf8',
);
const accessMigration = readFileSync(
  new URL('../db/migrations/20261022000200_expose_verified_catalog.sql', import.meta.url),
  'utf8',
);
const pgTapTest = readFileSync(
  new URL('../db/tests/transit_catalog_rls.test.sql', import.meta.url),
  'utf8',
);

describe('Neon database contract', () => {
  it('installs and references PostGIS objects from the dedicated extensions schema', () => {
    expect(catalogMigration).toMatch(/create schema if not exists extensions/i);
    expect(catalogMigration).toMatch(/create extension if not exists postgis with schema extensions/i);
    expect(catalogMigration).toMatch(/extensions\.(?:geometry|geography)/i);
    expect(catalogMigration).not.toMatch(/public\.(?:st_[a-z_]+|geometry|geography)/i);
    expect(accessMigration).toMatch(/extensions\.st_/i);
  });

  it('tests schema-qualified PostGIS geometry and geography types used by the published view', () => {
    expect(pgTapTest).toMatch(/set local search_path to public, extensions/i);
    expect(pgTapTest).toMatch(/extname\s*=\s*'postgis'[\s\S]*?nspname\s*=\s*'extensions'/i);
    expect(pgTapTest).toMatch(/typname\s*=\s*'geometry'[\s\S]*?nspname\s*=\s*'extensions'/i);
    expect(pgTapTest).toMatch(/typname\s*=\s*'geography'[\s\S]*?nspname\s*=\s*'extensions'/i);
    expect(pgTapTest).toMatch(/::extensions\.geometry/i);
    expect(pgTapTest).toMatch(/::extensions\.geography/i);
    expect(pgTapTest).toMatch(/public\.plan\(21\)/i);
  });

  it('creates pgTAP only in the test transaction, never in production migrations', () => {
    expect(pgTapTest).toMatch(/create extension if not exists pgtap/i);
    expect(`${catalogMigration}\n${accessMigration}`).not.toMatch(/create extension[^;]*pgtap/i);
  });

  it('checks the read-only API role, underlying-table access, and unpublished catalog rows', () => {
    expect(pgTapTest).toMatch(/has_table_privilege\('tata_catalog_reader',[\s\S]*?'select'\)/i);
    expect(pgTapTest).toMatch(/has_table_privilege\('tata_catalog_reader',[\s\S]*?'insert'\)/i);
    expect(pgTapTest).toMatch(/has_table_privilege\('tata_catalog_reader',[\s\S]*?'update'\)/i);
    expect(pgTapTest).toMatch(/has_table_privilege\('tata_catalog_reader',[\s\S]*?'delete'\)/i);
    expect(pgTapTest).toMatch(/from public\.published_transit_network\)[\s\S]*?2[\s\S]*?draft, pending, or rejected/i);
    expect(pgTapTest).toMatch(/where line_number in \('draft', 'pending', 'rejected'\)[\s\S]*?0[\s\S]*?cannot see draft, candidate, or rejected/i);
  });
});
