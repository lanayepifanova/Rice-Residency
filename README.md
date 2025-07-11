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

- Next.js 16 (App Router, Server Components)
- TypeScript
- PostgreSQL via Prisma 7, running locally
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

Everything is on this machine: Postgres holds the data, and it is not cleared by
refreshing the page or restarting the dev server. To see what is stored, open
`psql rice_residency`.

The site has no accounts — nothing to sign into, nothing to sign up for. The
house data is written by the seeds and by hand in `psql`, and everyone else
reads it.

## Deploying

The house data lives in Postgres on one laptop, and a server in a datacenter
cannot reach a laptop — so the deployed site reads a hosted copy of the database
that this machine pushes to:

```bash
npm run db:push-live   # dump the local database, load it into the live one
```

[DEPLOY.md](DEPLOY.md) has the whole path: Vercel, the database, what to change
before sharing the link, and what visitors can do once they have it. The short
version is that the whole site is public and read-only, so there is nothing to
guard.

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
- `src/lib/api/` — Zod contracts for the shapes the seeds and server modules
  pass around.
- `src/app/` — the pages, all of them server-rendered.

**Nothing here writes.** There are no accounts, no RSVP buttons, no host
controls, and no HTTP API — a visitor can read every page and change nothing,
which is what makes the site safe to hand out as a link. The domain logic behind
those features is still in `src/lib/server/` and still tested, because the shape
of an RSVP, a waitlist, and a capacity check did not stop being right when the
buttons came off. Adding accounts back means adding a way in, not rebuilding
what happens once someone is through it.

Two more rules are worth knowing before changing anything:

**A series start is a wall-clock time, not an instant.** `startsAtLocal` is text
like `2026-09-07T18:30`, paired with an IANA timezone. That is what keeps a
weekly 18:30 event at 18:30 after the clocks change. Occurrences store real UTC
instants, computed from the two.

**Capacity is settled under a row lock.** `submitRsvp` opens a transaction,
locks the occurrence row, and only then reads seat totals. Nothing calls it
while the site is read-only, but the lock is the reason it is safe to call from
a button again: skipping it reintroduces overselling under concurrent RSVPs.

## Docs

- [Deploying](DEPLOY.md) — putting this on the internet for the house to read
- [Product plan](docs/recurring-events-release-plan.md)
- [Release runbook](docs/release-runbook.md) — migrations, rollback, monitoring
- [Changelog](CHANGELOG.md)
