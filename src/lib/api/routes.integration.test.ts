import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";

// Route handlers read identity through getCurrentUser. Mocking it here stands
// in for a Supabase session without needing a browser or a live cookie jar.
const currentUser = vi.hoisted(() => ({ value: null as User | null }));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => currentUser.value,
  requireUser: async () => currentUser.value,
}));

const { prisma } = await import("@/lib/db");
const { createSeries } = await import("@/lib/server/series");
const { cleanupTestData, createTestUser, localDaysFromNow } = await import(
  "@/lib/server/test-helpers"
);

const seriesRoute = await import("@/app/api/event-series/route");
const seriesDetailRoute = await import("@/app/api/event-series/[seriesId]/route");
const instancesRoute = await import("@/app/api/event-series/[seriesId]/instances/route");
const cancelRoute = await import("@/app/api/event-series/[seriesId]/cancel/route");
const rsvpRoute = await import("@/app/api/event-instances/[instanceId]/rsvp/route");
const preferencesRoute = await import("@/app/api/me/notification-preferences/route");

let host: User;
let stranger: User;
let seriesId: string;
let instanceId: string;

beforeAll(async () => {
  host = await createTestUser("route-host");
  stranger = await createTestUser("route-stranger");

  currentUser.value = host;

  const series = await createSeries(host.id, {
    title: "Route Test Event",
    timezone: "America/New_York",
    startsAtLocal: localDaysFromNow(5, "18:00"),
    durationMinutes: 60,
    capacity: 10,
    inviteEmails: [],
    waitlistEnabled: true,
    visibility: "public",
    recurrence: { freq: "weekly", interval: 1 },
  });

  seriesId = series.id;
  instanceId = series.instances[0].id;
  currentUser.value = null;
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

function jsonRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost:3000/api/test", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("signed-out callers", () => {
  it("cannot create an event", async () => {
    const response = await seriesRoute.POST(
      jsonRequest({
        title: "Sneaky",
        timezone: "America/New_York",
        startsAtLocal: localDaysFromNow(2),
        durationMinutes: 60,
        recurrence: { freq: "weekly", interval: 1 },
      }),
    );

    expect(response.status).toBe(401);
    expect(await prisma.eventSeries.count({ where: { title: "Sneaky" } })).toBe(0);
  });

  it("cannot RSVP", async () => {
    const response = await rsvpRoute.PUT(jsonRequest({ status: "going", guestCount: 0 }, "PUT"), {
      params: Promise.resolve({ instanceId }),
    });

    expect(response.status).toBe(401);
    expect(await prisma.eventRsvp.count({ where: { instanceId } })).toBe(0);
  });

  it("cannot cancel or edit someone's event", async () => {
    const cancelled = await cancelRoute.POST(jsonRequest({ scope: "all" }), {
      params: Promise.resolve({ seriesId }),
    });
    const edited = await seriesDetailRoute.PATCH(
      jsonRequest({ scope: "all", title: "Hijacked" }, "PATCH"),
      { params: Promise.resolve({ seriesId }) },
    );

    expect(cancelled.status).toBe(401);
    expect(edited.status).toBe(401);

    const series = await prisma.eventSeries.findUnique({ where: { id: seriesId } });
    expect(series?.status).toBe("active");
    expect(series?.title).toBe("Route Test Event");
  });

  it("cannot read or change notification preferences", async () => {
    expect((await preferencesRoute.GET()).status).toBe(401);
    expect((await preferencesRoute.PATCH(jsonRequest({ email: true }, "PATCH"))).status).toBe(401);
  });

  it("can still read a public event and its occurrences", async () => {
    // A release gate: unauthenticated visitors must be able to view public
    // event pages.
    const detail = await seriesDetailRoute.GET(
      new Request(`http://localhost:3000/api/event-series/${seriesId}`),
      { params: Promise.resolve({ seriesId }) },
    );
    const instances = await instancesRoute.GET(
      new Request(`http://localhost:3000/api/event-series/${seriesId}/instances`),
      { params: Promise.resolve({ seriesId }) },
    );

    expect(detail.status).toBe(200);
    expect(instances.status).toBe(200);

    const body = (await detail.json()) as { series: { title: string; isOrganizer: boolean } };
    expect(body.series.title).toBe("Route Test Event");
    expect(body.series.isOrganizer).toBe(false);
  });
});

describe("a signed-in caller who is not the host", () => {
  it("is refused edits and cancellation", async () => {
    currentUser.value = stranger;

    const edited = await seriesDetailRoute.PATCH(
      jsonRequest({ scope: "all", title: "Hijacked" }, "PATCH"),
      { params: Promise.resolve({ seriesId }) },
    );
    const cancelled = await cancelRoute.POST(jsonRequest({ scope: "all" }), {
      params: Promise.resolve({ seriesId }),
    });

    expect(edited.status).toBe(403);
    expect(cancelled.status).toBe(403);

    const series = await prisma.eventSeries.findUnique({ where: { id: seriesId } });
    expect(series?.title).toBe("Route Test Event");
    expect(series?.status).toBe("active");

    currentUser.value = null;
  });

  it("cannot impersonate anyone with a header", async () => {
    currentUser.value = stranger;

    // The old implementation trusted x-user-id. Setting it must now change
    // nothing about who the RSVP belongs to.
    const request = new Request("http://localhost:3000/api/test", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-user-id": host.id },
      body: JSON.stringify({ status: "going", guestCount: 0 }),
    });

    const response = await rsvpRoute.PUT(request, { params: Promise.resolve({ instanceId }) });
    expect(response.status).toBe(200);

    const rsvps = await prisma.eventRsvp.findMany({ where: { instanceId } });
    expect(rsvps).toHaveLength(1);
    expect(rsvps[0].userId).toBe(stranger.id);

    currentUser.value = null;
  });
});

describe("validation", () => {
  it("rejects a malformed create request with 400", async () => {
    currentUser.value = host;

    const response = await seriesRoute.POST(
      jsonRequest({ title: "", timezone: "Not/AZone", durationMinutes: 0 }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { issues?: unknown };
    expect(body.issues).toBeTruthy();

    currentUser.value = null;
  });

  it("rejects a self-assigned waitlisted status", async () => {
    currentUser.value = host;

    // `waitlisted` is system-assigned. Accepting it from a client would let
    // someone place themselves on a waitlist that has room, or off one that
    // does not.
    const response = await rsvpRoute.PUT(
      jsonRequest({ status: "waitlisted", guestCount: 0 }, "PUT"),
      { params: Promise.resolve({ instanceId }) },
    );

    expect(response.status).toBe(400);

    currentUser.value = null;
  });
});
