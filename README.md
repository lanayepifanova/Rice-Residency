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
- PostgreSQL via Prisma 7
- Supabase for auth (magic link) and storage
- Tailwind CSS
- Vitest

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npx prisma migrate deploy
npm run db:seed              # optional: the three house events and a demo directory
npm run dev
```

## Quality checks

```bash
npm run lint
npm run test              # unit tests, no database needed
npm run test:integration  # integration tests against DATABASE_URL
npm run build
```

`test:integration` writes to whatever database `DATABASE_URL` points at. It
cleans up after itself, but point it at a development project.

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

Two rules are worth knowing before changing anything:

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
