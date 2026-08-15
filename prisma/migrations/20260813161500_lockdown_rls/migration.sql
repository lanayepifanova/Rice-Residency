-- Lock down PostgREST access to Prisma-managed tables.
--
-- WHY THIS EXISTS
-- Supabase grants the `anon` and `authenticated` roles access to every table
-- created in the `public` schema, via ALTER DEFAULT PRIVILEGES. Prisma creates
-- tables with row-level security disabled. The combination means that without
-- this migration, anyone holding the publishable key -- which is public by
-- design and ships in the browser bundle -- can read and write every table
-- through the auto-generated PostgREST API at <project>.supabase.co/rest/v1/.
-- This was verified empirically: an anonymous INSERT into "User" succeeded.
--
-- WHY IT IS SAFE FOR THE APP
-- Matane never uses PostgREST. All database access goes through Prisma over a
-- direct Postgres connection as the `postgres` role, which owns these tables.
-- Table owners bypass RLS unless FORCE ROW LEVEL SECURITY is set, so enabling
-- RLS with zero policies denies anon/authenticated everything while leaving
-- the application completely unaffected.

-- 1. Enable RLS on every application table. No policies are defined, so the
--    default deny applies to every non-owner role.
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EventSeries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EventInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EventRsvp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EventShareLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NotificationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NotificationDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NotificationPreference" ENABLE ROW LEVEL SECURITY;

-- Prisma's own bookkeeping table: hide migration history from the public API.
-- Guarded because this table does not exist while Prisma replays migrations
-- into a fresh shadow database during `migrate dev`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 2. Defense in depth: remove the grants themselves, so access is denied even
--    if RLS is later disabled on a table by accident.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM anon, authenticated;

-- 3. Close the hole for FUTURE tables. Without this, the next Prisma migration
--    creates new tables that are once again world-writable.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- NOTE: new tables added by future migrations still need their own
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` line. Step 3 removes their
-- grants, but enabling RLS explicitly keeps both layers intact.
