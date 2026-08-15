# Release Runbook

## Preflight

```bash
npm run lint
npm run test              # unit: recurrence and RSVP rules, no database
npm run test:integration  # integration: needs DATABASE_URL
npm run build
```

All four must pass. The integration suite writes to the database in
`DATABASE_URL`, so point it at a staging project rather than production.

## Environment

Required, per `.env.example`:

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | app runtime | Transaction pooler, port 6543 |
| `DIRECT_URL` | Prisma CLI | Session pooler, port 5432, for DDL |
| `NEXT_PUBLIC_SUPABASE_URL` | app + browser | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app + browser | Safe to expose |
| `SUPABASE_SECRET_KEY` | server only | Storage uploads; never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | optional | Pins magic-link and share-link origin |

## Migrations

```bash
npx prisma migrate deploy
```

Five migrations, applied in order:

1. `20260813160753_init` — base schema
2. `20260813161500_lockdown_rls` — RLS on every table, grants revoked from
   `anon` and `authenticated`
3. `20260813205840_link_user_to_supabase_auth` — `User.email` required
4. `20260814190000_events_profiles_invites_shares` — profile fields, invites,
   share-link ownership, notification dedupe and read state, instance override
   columns, and `startsAtLocal` from `timestamp` to `text`
5. `20260814190500_avatars_storage_bucket` — public `avatars` storage bucket

### Review notes

- Migration 4 rewrites `EventSeries.startsAtLocal` in place with an explicit
  `USING to_char(...)` cast. Postgres' default timestamp-to-text output uses a
  space separator and would not parse as the app's `YYYY-MM-DDTHH:MM` format.
- Migration 4 adds three unique indexes. They fail loudly rather than silently
  if duplicates exist: `EventInstance(seriesId, startsAt)`,
  `NotificationEvent(dedupeKey)`, `User(username)`. Check for duplicates before
  deploying to a database with real traffic.
- Any future migration that adds a table must also
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Migration 2 revokes default
  grants for new tables, but enabling RLS explicitly keeps both layers intact.

## Seeding

```bash
npm run db:seed
```

Idempotent. Creates seven users and nine public event series, with RSVPs across
every status, one event filled to capacity with two people waitlisted, one event
with the waitlist disabled, and one cancelled occurrence. Intended for local
work and staging, not production.

## Rollback

**Application only** — the usual case. Redeploy the previous build. Every
migration in this release is additive except the `startsAtLocal` type change, so
the previous application version keeps running against the new schema with one
exception: it reads `startsAtLocal` as a timestamp and will fail on that column.
If rolling back the app across that migration, roll the column back too:

```sql
ALTER TABLE "EventSeries"
  ALTER COLUMN "startsAtLocal" TYPE timestamp(3)
  USING "startsAtLocal"::timestamp;
```

**Full schema rollback** to before migration 4:

```sql
-- Drop what migration 4 added.
DROP TABLE IF EXISTS "EventInvite";
ALTER TABLE "EventSeries" DROP COLUMN IF EXISTS "coverImage",
                          DROP COLUMN IF EXISTS "materializedThrough";
ALTER TABLE "EventInstance" DROP COLUMN IF EXISTS "overrideTitle",
                            DROP COLUMN IF EXISTS "overrideDescription",
                            DROP COLUMN IF EXISTS "overrideLocationName",
                            ADD COLUMN IF NOT EXISTS "overrideFields" JSONB;
ALTER TABLE "EventShareLink" DROP COLUMN IF EXISTS "createdById",
                             DROP COLUMN IF EXISTS "openCount",
                             DROP COLUMN IF EXISTS "lastOpenedAt";
ALTER TABLE "NotificationDelivery" DROP COLUMN IF EXISTS "readAt",
                                   DROP COLUMN IF EXISTS "sentAt";
ALTER TABLE "NotificationEvent" DROP COLUMN IF EXISTS "dedupeKey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "username",
                   DROP COLUMN IF EXISTS "avatarUrl",
                   DROP COLUMN IF EXISTS "bio",
                   DROP COLUMN IF EXISTS "instagram",
                   DROP COLUMN IF EXISTS "twitter",
                   DROP COLUMN IF EXISTS "birthday";
DELETE FROM "_prisma_migrations"
  WHERE migration_name IN (
    '20260814190000_events_profiles_invites_shares',
    '20260814190500_avatars_storage_bucket'
  );
```

This drops event invites and profile data permanently. Take a backup first.

Migration 5 only inserts a storage bucket row; leaving it in place is harmless
and avoids deleting anyone's uploaded photo.

## Monitoring

Notification delivery is a queue in the database, so failures are queryable
rather than invisible.

```sql
-- Deliveries stuck pending. In-app rows are marked sent on write, so anything
-- pending is waiting on a channel adapter that does not exist yet.
SELECT channel, status, count(*)
FROM "NotificationDelivery"
WHERE "createdAt" > now() - interval '1 day'
GROUP BY channel, status;

-- Deliveries that failed outright, with the reason.
SELECT id, channel, attempts, "lastError", "createdAt"
FROM "NotificationDelivery"
WHERE status = 'failed'
ORDER BY "createdAt" DESC
LIMIT 50;

-- Occurrences that ran out of runway: a series whose rolling window stopped
-- being topped up would show no future occurrences here.
SELECT s.id, s.title, max(i."startsAt") AS last_generated
FROM "EventSeries" s
LEFT JOIN "EventInstance" i ON i."seriesId" = s.id
WHERE s.status = 'active'
GROUP BY s.id, s.title
HAVING max(i."startsAt") < now() + interval '30 days';
```

An alert on the second query returning rows, and on the third returning rows for
a series with no `recurrenceUntil`, covers the two failure modes that would be
invisible to users until an event silently stopped appearing.

## Known limitations

- Email, push, and SMS deliveries are recorded and left `pending`. No adapter
  drains them yet; the plan puts those after the MVP.
- Occurrence reminders (`instance_reminder`) have a notification type and no
  scheduler. Adding one is a job that queries upcoming occurrences and calls
  `recordNotifications`.
- Materialization happens when a series is read. A series nobody opens for over
  a year would need its first reader to trigger the top-up, which happens on
  that read before the page renders.
