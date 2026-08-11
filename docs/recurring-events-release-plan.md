# Recurring Events Release Plan

## Operating Model

The Founder/Orchestrator owns prioritization, scope control, acceptance criteria, cross-agent alignment, and final completion decisions. Work is delegated to specialized agents, but functionality is only marked complete after QA/security passes.

## Agents

- Founder/Orchestrator: owns roadmap, sequencing, decisions, acceptance review, and release readiness.
- Product/UX Agent: owns user flows, screens, copy, validation states, destructive-action clarity, and edge cases.
- Systems Architect: owns schema, recurrence model, API contracts, permissions, notification architecture, and migration risk.
- Frontend Engineer: owns UI implementation, client validation, recurrence preview, RSVP surfaces, share controls, and notification UI.
- Backend Engineer: owns persistence, recurrence generation, authorization, RSVP/capacity invariants, notification events, and share link behavior.
- QA/Security Agent: owns test planning, permission abuse testing, recurrence edge cases, privacy checks, and release-blocking bug reports.
- Release Agent: owns migrations, deployment, monitoring, rollout, rollback, and changelog.

## MVP Scope

Priority order:

1. Recurring event creation
2. Recurrence preview and generated instances
3. RSVP flow with guest counts, capacity, and waitlist
4. Notification foundation
5. Social sharing
6. QA/security hardening
7. Release readiness

## Product Decisions

- Initial scale target: about 50 users.
- Recommended stack: Next.js, TypeScript, PostgreSQL, Prisma, Tailwind CSS, Vitest, Playwright.
- Visibility for MVP: public events for everyone.
- RSVP states: `going`, `maybe`, `busy`.
- Capacity limits: in scope.
- Guest counts: in scope.
- Guest count limit: no product-level maximum per RSVP.
- Waitlist: in scope.
- Waitlist control: hosts can enable, disable, and configure waitlist behavior per event.
- Public access: unauthenticated users can view public event pages.
- Recurring series dates: optional start and end dates.
- Never-ending series: allowed, but recurrence generation must be capped at 10 years.
- Recurrence complexity: flexible RRULE-style recurrence is in scope, including intervals such as every 2 weeks or every 5 days.
- Notification channels: build notification foundation first. SMS and push are post-MVP channel adapters.

## Notification Scope

MVP notification architecture must support multiple channels, even if only one channel is enabled at launch.

Initial events:

- Event series created
- User invited or share opened
- RSVP changed
- Capacity reached
- Waitlist position changed
- Waitlisted user promoted
- Instance reminder
- Instance changed
- Instance cancelled
- Series cancelled

Channel priority:

1. In-app notification model and preferences
2. Email-compatible outbox, if needed for early usability
3. Push notifications post-MVP
4. SMS notifications post-MVP

Push and SMS should be implemented later behind channel adapters so provider integration does not change domain logic.

## Shared Domain Model

Core entities:

- `User`
- `EventSeries`
- `EventInstance`
- `EventRsvp`
- `EventShareLink`
- `NotificationEvent`
- `NotificationDelivery`
- `NotificationPreference`

Optional later entities:

- `EventInvite`
- `EventSeriesPermission`
- `EventAuditLog`

## Recurrence Model

Recurring events are represented as one `EventSeries` with generated `EventInstance` records.

Rules:

- Store timezone explicitly on the series.
- Store recurrence using an RRULE-like JSON shape.
- Support flexible intervals for supported frequencies, such as every 5 days or every 2 weeks.
- Support advanced calendar patterns when expressible in the recurrence library, such as weekday patterns and positional monthly rules.
- Materialize instances on a rolling horizon.
- Never materialize beyond 10 years from the series start.
- Cancellations are explicit instance states.
- Single-occurrence edits use instance overrides.
- Future edits require explicit scope.
- RSVPs attach to instances, not only to the series.

Example recurrence:

```json
{
  "freq": "weekly",
  "interval": 1,
  "byDay": ["MO"],
  "until": null,
  "count": null
}
```

## API Contract Draft

```http
POST /event-series
GET /event-series/{seriesId}
GET /event-series/{seriesId}/instances?from=2026-09-01&to=2026-10-01
PATCH /event-series/{seriesId}
PATCH /event-instances/{instanceId}
POST /event-instances/{instanceId}/cancel
POST /event-series/{seriesId}/cancel
PUT /event-instances/{instanceId}/rsvp
POST /event-series/{seriesId}/share-links
POST /event-instances/{instanceId}/share-links
GET /me/notifications
PATCH /me/notification-preferences
```

Create series request:

```json
{
  "title": "Weekly Run Club",
  "description": "Meet by the park entrance.",
  "timezone": "America/New_York",
  "startsAtLocal": "2026-09-07T18:30:00",
  "durationMinutes": 60,
  "capacity": 20,
  "waitlistEnabled": true,
  "visibility": "public",
  "recurrence": {
    "freq": "weekly",
    "interval": 1,
    "byDay": ["MO"],
    "until": null,
    "count": null
  }
}
```

RSVP request:

```json
{
  "status": "going",
  "guestCount": 1
}
```

Valid RSVP statuses:

- `going`
- `maybe`
- `busy`
- `waitlisted`

`waitlisted` is system-assigned when capacity is full. Users should not directly set themselves to `waitlisted`.

## RSVP Invariants

- One RSVP per user per event instance.
- RSVP requires access to the instance.
- RSVP is rejected for cancelled instances.
- Capacity checks must be transactional.
- Guest count contributes to capacity.
- Guest count has no product-level maximum, but must be a non-negative integer and may still be constrained by remaining capacity.
- `maybe` and `busy` do not consume capacity.
- `going` consumes `1 + guestCount` capacity.
- If capacity is full, a `going` RSVP becomes `waitlisted` unless waitlist is disabled.
- If waitlist is disabled and capacity is full, new `going` RSVPs must be rejected with a clear capacity-full response.
- Waitlist promotion happens when capacity opens.
- RSVP updates must emit notification events where relevant.

## UX Requirements

Creation flow:

- Event details
- Date and time
- Recurrence rule
- Capacity and guest settings
- Preview occurrences
- Publish

Required states:

- Empty
- Draft
- Validation error
- Publishing
- Publish success
- Permission denied
- Capacity full
- Waitlisted
- RSVP changed
- Instance cancelled

Required copy behavior:

- Always distinguish `this occurrence`, `all future occurrences`, and `entire series`.
- Confirm destructive actions.
- Show recurrence in plain language.
- Show capacity and waitlist status near RSVP controls.

## QA Gates

Release-blocking checks:

- Recurrence handles timezone, DST, leap years, and month-end dates.
- Flexible recurrence intervals and advanced RRULE-style patterns generate expected instances.
- Recurrence generation never exceeds 10 years.
- Public event pages are viewable by unauthenticated users.
- Unauthorized users cannot mutate event, RSVP, capacity, notification, or share state.
- Duplicate submissions do not create duplicate series, instances, or RSVPs.
- Capacity and waitlist behavior is correct under concurrent RSVP attempts.
- Guest counts cannot exceed configured limits.
- Cancelled instances reject RSVPs.
- Notification events are deduplicated.
- Notification channel adapters do not leak private data in message content.
- Social share previews do not expose data beyond public MVP visibility rules.

## Release Gates

The Release Agent may approve deployment only after:

- Database migrations are reviewed.
- Seed data exists for recurring events, capacity, waitlist, and RSVP states.
- Unit tests pass for recurrence and RSVP rules.
- E2E tests pass for create, preview, RSVP, waitlist, and share flows.
- Monitoring exists for notification delivery failures.
- Rollback plan is documented.
- Changelog is written.

## Post-MVP Questions

- Which provider should be used for push notifications?
- Which provider should be used for SMS notifications?
