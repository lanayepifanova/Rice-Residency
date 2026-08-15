import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { renderNotification } from "@/lib/domain/notifications";
import { createSeries } from "./series";
import { submitRsvp } from "./rsvp";
import {
  getPreferences,
  listInbox,
  markInboxRead,
  recordNotifications,
  unreadCount,
  updatePreferences,
} from "./notifications";
import { createShareLink, resolveShareLink, revokeShareLink } from "./share-links";
import { cleanupTestData, createTestUser, localDaysFromNow } from "./test-helpers";

let host: User;
let attendee: User;
let other: User;

beforeAll(async () => {
  host = await createTestUser("notify-host");
  attendee = await createTestUser("notify-attendee");
  other = await createTestUser("notify-other");
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

async function makeSeries(capacity: number | null = null) {
  return createSeries(host.id, {
    title: "Notification Test Event",
    timezone: "America/New_York",
    startsAtLocal: localDaysFromNow(4, "18:00"),
    durationMinutes: 60,
    capacity,
    inviteEmails: [],
    waitlistEnabled: true,
    visibility: "public",
    recurrence: { freq: "weekly", interval: 1 },
  });
}

describe("recording", () => {
  it("delivers to the in-app inbox when a series is created", async () => {
    const series = await makeSeries();

    const inbox = await listInbox(host.id);
    const created = inbox.find(
      (item) => item.type === "event_series_created" && item.body.includes(series.title),
    );

    expect(created).toBeTruthy();
    expect(created?.href).toBe(`/events/${series.id}`);
    expect(created?.readAt).toBeNull();
  });

  it("deduplicates events that must only happen once", async () => {
    const series = await makeSeries();

    // Same dedupe key twice, fired concurrently: the unique index decides.
    await Promise.all([
      recordNotifications([
        {
          type: "capacity_reached",
          seriesId: series.id,
          dedupeKey: `test-dedupe:${series.id}`,
          payload: { title: series.title },
          recipientIds: [host.id],
        },
      ]),
      recordNotifications([
        {
          type: "capacity_reached",
          seriesId: series.id,
          dedupeKey: `test-dedupe:${series.id}`,
          payload: { title: series.title },
          recipientIds: [host.id],
        },
      ]),
    ]);

    const events = await prisma.notificationEvent.findMany({
      where: { dedupeKey: `test-dedupe:${series.id}` },
    });

    expect(events).toHaveLength(1);
  });

  it("tells the host exactly once when an occurrence fills up", async () => {
    const series = await makeSeries(1);
    const instance = series.instances[0];

    await submitRsvp({ instanceId: instance.id, userId: attendee.id, status: "going", guestCount: 0 });
    // A second attempt also finds it full, but must not notify again.
    await submitRsvp({ instanceId: instance.id, userId: other.id, status: "going", guestCount: 0 });

    const events = await prisma.notificationEvent.findMany({
      where: { type: "capacity_reached", instanceId: instance.id },
    });

    expect(events).toHaveLength(1);
  });

  it("notifies someone when they are promoted off the waitlist", async () => {
    const series = await makeSeries(1);
    const instance = series.instances[0];

    await submitRsvp({ instanceId: instance.id, userId: attendee.id, status: "going", guestCount: 0 });
    await submitRsvp({ instanceId: instance.id, userId: other.id, status: "going", guestCount: 0 });
    await submitRsvp({ instanceId: instance.id, userId: attendee.id, status: "busy", guestCount: 0 });

    const inbox = await listInbox(other.id);
    expect(inbox.some((item) => item.type === "waitlist_promoted")).toBe(true);
  });

  it("respects a recipient's channel preferences", async () => {
    await updatePreferences(other.id, { inApp: false, email: true });

    const series = await makeSeries();
    await recordNotifications([
      {
        type: "instance_changed",
        seriesId: series.id,
        payload: { title: series.title },
        recipientIds: [other.id],
      },
    ]);

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { userId: other.id, notificationEvent: { seriesId: series.id } },
    });

    expect(deliveries.map((delivery) => delivery.channel)).toEqual(["email"]);
    // Email is queued for an adapter rather than treated as already delivered.
    expect(deliveries[0].status).toBe("pending");

    await updatePreferences(other.id, { inApp: true, email: false });
    expect(await getPreferences(other.id)).toMatchObject({ inApp: true, email: false });
  });
});

describe("inbox", () => {
  it("counts unread and clears them on demand", async () => {
    await makeSeries();

    expect(await unreadCount(host.id)).toBeGreaterThan(0);

    await markInboxRead(host.id);

    expect(await unreadCount(host.id)).toBe(0);
    expect((await listInbox(host.id)).every((item) => item.readAt !== null)).toBe(true);
  });
});

describe("message content", () => {
  it("never puts another attendee's identity into a message body", () => {
    // Message bodies travel through email, push, and SMS providers. Anything
    // handed to renderNotification that is not public event data must not come
    // back out in the text.
    const rendered = renderNotification("rsvp_changed", {
      title: "Dinner",
      when: "2026-09-10",
      status: "going",
      // Fields a caller might carelessly attach:
      attendeeEmail: "private@example.com",
      attendeeName: "Private Person",
    });

    expect(rendered.body).not.toContain("private@example.com");
    expect(rendered.body).not.toContain("Private Person");
    expect(rendered.body).toContain("Dinner");
  });
});

describe("share links", () => {
  it("resolves a token, records the open, and stops once revoked", async () => {
    const series = await makeSeries();
    const link = await createShareLink({ kind: "series", seriesId: series.id }, host.id);

    expect(link.token).toHaveLength(32);

    const resolved = await resolveShareLink(link.token);
    expect(resolved?.series.id).toBe(series.id);
    expect(resolved?.instance).toBeNull();

    const opened = await prisma.eventShareLink.findUnique({ where: { id: link.id } });
    expect(opened?.openCount).toBe(1);
    expect(opened?.lastOpenedAt).not.toBeNull();

    await revokeShareLink(link.id, host.id);
    expect(await resolveShareLink(link.token)).toBeNull();
  });

  it("resolves an occurrence link to that occurrence", async () => {
    const series = await makeSeries();
    const instance = series.instances[1];
    const link = await createShareLink({ kind: "instance", instanceId: instance.id }, host.id);

    const resolved = await resolveShareLink(link.token);

    expect(resolved?.instance?.id).toBe(instance.id);
    expect(resolved?.series.id).toBe(series.id);
  });

  it("refuses to create or revoke links for anyone but the host", async () => {
    const series = await makeSeries();

    await expect(
      createShareLink({ kind: "series", seriesId: series.id }, attendee.id),
    ).rejects.toMatchObject({ code: "forbidden" });

    const link = await createShareLink({ kind: "series", seriesId: series.id }, host.id);

    await expect(revokeShareLink(link.id, attendee.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("returns nothing for a token that was never issued", async () => {
    expect(await resolveShareLink("not-a-real-token")).toBeNull();
  });
});
