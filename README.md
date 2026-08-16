# Rice Residency

The calendar and directory for Rice Residency, a hacker house in Houston.

The house runs a handful of standing events — weekly Sunday coworking sessions,
biweekly Friday house parties, and VC-sponsored networking dinners — so the home
page is organised by event rather than by date: each series lists its own run of
dates, people RSVP per date with guest counts, capacity limits, and a waitlist,
and dates that have happened move to the archive. Events still being planned are
announced by name until their schedule is settled.

The other half is the people. Every resident has a profile with their year at
Rice, major, what they are building, what they have shipped before, and what
they need help with — searchable, so the house can find each other by project
and not only by name.

## Stack

- Next.js 16 (App Router, Server Components, Server Actions)
- TypeScript
- PostgreSQL via Prisma 7, running locally
- Email + password auth and profile photos, both owned by this app
- Tailwind CSS
- Vitest

## Setup

```bash
brew services start postgresql@14   # the database this app talks to
createdb rice_residency             # first time only

# Two migrations predate this app owning its own database and revoke grants
# from roles Supabase used to provide. Plain Postgres has no such roles, and
# `REVOKE ... FROM <missing role>` is an error, so create them empty. They can
# log in to nothing and own nothing — they exist only to be revoked from.
# Roles are cluster-wide, so this is once per machine, not once per database:
# "role already exists" means it is already done.
psql -d rice_residency -c "CREATE ROLE anon NOLOGIN" -c "CREATE ROLE authenticated NOLOGIN"

npm install
cp .env.example .env.local   # then fill in your macOS username
npx prisma migrate deploy
npm run db:seed              # optional: the three house events and a demo directory
npm run dev
```

Everything is on this machine: Postgres holds the data, `public/uploads/` holds
profile photos, and neither is cleared by refreshing the page or restarting the
dev server. To see what is stored, open `psql rice_residency`.

Seeded accounts sign in with the password `residency` — `lana@example.com` is
the organizer of all three events.

## Quality checks

```bash
npm run lint
npm run test              # unit tests, no database needed
npm run test:integration  # integration tests against DATABASE_URL
npm run build
```

`test:integration` writes to whatever database `DATABASE_URL` points at. It
cleans up after itself, but point it at a development database.

## How it fits together

- `src/lib/domain/` — pure logic with no I/O: recurrence expansion, timezone
  maths, RSVP and waitlist rules, notification rendering, formatting. Unit
  tested.
- `src/lib/server/` — everything that touches the database: series, RSVP,
  notifications, share links, profile, feed queries. Integration tested.
- `src/lib/api/` — request contracts (Zod) and route helpers.
- `src/app/api/` — the HTTP contract.
- `src/app/` — pages, Server Actions, and the few client components that need
  pending and error states.

**Auth is local and deliberately simple.** Accounts are an email and a scrypt
hash (`src/lib/server/password.ts`); a session is a random token in an httpOnly
cookie whose SHA-256 is a row in `Session` (`src/lib/server/session.ts`), so
signing out revokes access rather than trusting the browser to forget. There is
no email sender, which means no password reset — resetting one is a `psql`
update away. Putting this app on the public internet would need that gap closed
first.

Two more rules are worth knowing before changing anything:

**A series start is a wall-clock time, not an instant.** `startsAtLocal` is text
like `2026-09-07T18:30`, paired with an IANA timezone. That is what keeps a
weekly 18:30 event at 18:30 after the clocks change. Occurrences store real UTC
instants, computed from the two.

**Capacity is settled under a row lock.** `submitRsvp` opens a transaction,
locks the occurrence row, and only then reads seat totals. Skipping the lock
reintroduces overselling under concurrent RSVPs.

## Docs

- [Product plan](docs/recurring-events-release-plan.md)
- [Release runbook](docs/release-runbook.md) — migrations, rollback, monitoring
- [Changelog](CHANGELOG.md)
