-- migrate:up
-- Keep this enum change in its own migration. PostgreSQL does not allow a newly
-- added enum value to be used until the transaction that adds it has committed.
alter type public.catalogue_status add value if not exists 'incomplete';

-- migrate:down
-- PostgreSQL cannot remove an enum value safely while the type may be in use.
-- The value is intentionally retained on rollback; older code ignores it.
