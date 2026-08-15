# Changelog

## Unreleased — Recurring events MVP

The app previously kept created events in an in-memory map and rendered a
hardcoded array of nine fake events. Nothing a user did survived a restart.
This release replaces that with real persistence and completes the flows the
release plan calls for.

### Persistence

- Event series, occurrences, RSVPs, invites, share links, and notifications are
  stored in Postgres through Prisma. The in-memory `demoStore` is gone.
- `EventSeries.startsAtLocal` changed from `timestamp` to `text`. A recurring
  event's start is a wall-clock time that must survive daylight saving changes;
  a timestamp column forced it to be read as an instant.
- Occurrences are materialized on a rolling one-year window rather than a fixed
  first twelve, capped at the ten-year product limit. A unique index on
  `(seriesId, startsAt)` makes generation idempotent.
- `EventInstance.overrideFields` (JSON) became explicit nullable override
  columns, so a single-occurrence edit is queryable and "unset" is
  distinguishable from "set to empty".
- `EventRsvp.partySize` now defaults to 0, matching the rule that only `going`
  consumes capacity.

### Correctness

- Capacity is now checked inside a transaction that takes a row lock on the
  occurrence. Concurrent RSVPs to the same occurrence can no longer oversell it.
- Waitlist promotion exists: when seats free up, people move off the waitlist in
  order and the remaining positions are renumbered with no gaps.
- Notification events carry a unique `dedupeKey`, so events that must fire once
  (an occurrence reaching capacity) fire exactly once under concurrency.

### Security

- API routes take identity from the verified Supabase session. The previous
  `x-user-id` header fallback let any caller act as any user, and is removed.
- Every mutating endpoint checks that the caller is the host.
- Share links use a 24-byte random token, can be revoked, and record their opens.

### API

Added the remaining endpoints from the contract: `GET`/`PATCH` a series,
`GET` its instances over a date range, cancel a series or a single occurrence,
`PATCH` a single occurrence, create and list share links, read and mark the
notification inbox, and read and update notification preferences.

Edits and cancellations take an explicit scope — this occurrence, all future
occurrences, or the entire series. A future-scoped edit splits the series so
occurrences that already happened keep the details they were published with.

### Product

- Home, explore, event, and occurrence pages read from the database.
- RSVP controls exist, with capacity, remaining spots, and waitlist position
  shown next to them.
- The create flow previews occurrences before publishing and reports validation
  errors per field.
- Notifications inbox, notification preferences, profile viewing, and profile
  editing with real photo uploads to Supabase Storage.
- Nav entries that pointed at pages this product does not have (Messages,
  Mutuals, Feedback, Help) were removed. `/logout` now works.
- Empty, cancelled, full, waitlisted, and permission-denied states are rendered
  rather than implied.

### Testing

- 13 unit tests over recurrence and RSVP rules.
- 43 integration tests against a real Postgres database, covering creation,
  materialization idempotency, the ten-year cap, scoped edits and the series
  split, cancellation, capacity, guest counts, waitlist ordering and promotion,
  concurrent RSVPs, notification dedupe, channel preferences, share links, and
  endpoint authorization.
