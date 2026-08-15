import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EventInstance, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cancelInstance, cancelSeries, createSeries } from "./series";
import { getAttendance, submitRsvp } from "./rsvp";
import { cleanupTestData, createTestUser, localDaysFromNow } from "./test-helpers";

let host: User;
let guests: User[];

beforeAll(async () => {
  host = await createTestUser("rsvp-host");
  guests = await Promise.all(
    Array.from({ length: 8 }, (_, index) => createTestUser(`guest-${index}`)),
  );
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

async function makeEvent(options: { capacity: number | null; waitlistEnabled?: boolean }) {
  const series = await createSeries(host.id, {
    title: "Capacity Test Dinner",
    timezone: "America/New_York",
    startsAtLocal: localDaysFromNow(3, "19:00"),
    durationMinutes: 90,
    capacity: options.capacity,
    inviteEmails: [],
    waitlistEnabled: options.waitlistEnabled ?? true,
    visibility: "public",
    recurrence: { freq: "weekly", interval: 1 },
  });

  return { series, instance: series.instances[0] as EventInstance };
}

describe("capacity", () => {
  it("counts the guest count against capacity", async () => {
    const { series, instance } = await makeEvent({ capacity: 5 });

    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 2 });

    const attendance = await getAttendance(instance.id, series.capacity);

    // One person plus two guests is three seats, not one.
    expect(attendance.capacity.seatsUsed).toBe(3);
    expect(attendance.capacity.seatsRemaining).toBe(2);
    expect(attendance.capacity.isFull).toBe(false);
  });

  it("does not consume capacity for maybe or busy", async () => {
    const { series, instance } = await makeEvent({ capacity: 2 });

    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "maybe", guestCount: 4 });
    await submitRsvp({ instanceId: instance.id, userId: guests[1].id, status: "busy", guestCount: 0 });

    const attendance = await getAttendance(instance.id, series.capacity);
    expect(attendance.capacity.seatsUsed).toBe(0);
  });

  it("frees the seats back when someone changes going to busy", async () => {
    const { series, instance } = await makeEvent({ capacity: 4 });

    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 3 });
    expect((await getAttendance(instance.id, series.capacity)).capacity.isFull).toBe(true);

    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "busy", guestCount: 0 });

    const attendance = await getAttendance(instance.id, series.capacity);
    expect(attendance.capacity.seatsUsed).toBe(0);
    expect(attendance.capacity.isFull).toBe(false);
  });
});

describe("waitlist", () => {
  it("waitlists once capacity is gone, in the order people arrived", async () => {
    const { instance } = await makeEvent({ capacity: 2 });

    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 1 });

    const second = await submitRsvp({
      instanceId: instance.id,
      userId: guests[1].id,
      status: "going",
      guestCount: 0,
    });
    const third = await submitRsvp({
      instanceId: instance.id,
      userId: guests[2].id,
      status: "going",
      guestCount: 0,
    });

    expect(second.rsvp.status).toBe("waitlisted");
    expect(second.rsvp.waitlistRank).toBe(1);
    expect(third.rsvp.status).toBe("waitlisted");
    expect(third.rsvp.waitlistRank).toBe(2);
  });

  it("turns people away when the waitlist is disabled", async () => {
    const { instance } = await makeEvent({ capacity: 1, waitlistEnabled: false });

    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 0 });

    await expect(
      submitRsvp({ instanceId: instance.id, userId: guests[1].id, status: "going", guestCount: 0 }),
    ).rejects.toMatchObject({ code: "capacity_full" });

    const attendance = await getAttendance(instance.id, 1);
    expect(attendance.capacity.seatsUsed).toBe(1);
  });

  it("promotes the next in line when a spot opens, and closes the gap behind them", async () => {
    const { instance } = await makeEvent({ capacity: 2 });

    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 1 });
    await submitRsvp({ instanceId: instance.id, userId: guests[1].id, status: "going", guestCount: 0 });
    await submitRsvp({ instanceId: instance.id, userId: guests[2].id, status: "going", guestCount: 0 });

    // The party of two leaves, freeing exactly two seats.
    const outcome = await submitRsvp({
      instanceId: instance.id,
      userId: guests[0].id,
      status: "busy",
      guestCount: 0,
    });

    expect(outcome.promotedUserIds).toContain(guests[1].id);
    expect(outcome.promotedUserIds).toContain(guests[2].id);

    const rows = await prisma.eventRsvp.findMany({ where: { instanceId: instance.id } });
    const promoted = rows.filter((row) => row.status === "going");

    expect(promoted.map((row) => row.userId).sort()).toEqual([guests[1].id, guests[2].id].sort());
    expect(rows.every((row) => row.status !== "waitlisted")).toBe(true);
  });

  it("keeps the queue in order rather than letting a smaller party jump ahead", async () => {
    const { instance } = await makeEvent({ capacity: 3 });

    // Three seats taken, then a party of three waiting, then a single.
    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 2 });
    await submitRsvp({ instanceId: instance.id, userId: guests[1].id, status: "going", guestCount: 2 });
    await submitRsvp({ instanceId: instance.id, userId: guests[2].id, status: "going", guestCount: 0 });

    // Only one seat opens: not enough for the party of three at the front.
    await submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 1 });

    const rows = await prisma.eventRsvp.findMany({ where: { instanceId: instance.id } });
    const first = rows.find((row) => row.userId === guests[1].id);
    const second = rows.find((row) => row.userId === guests[2].id);

    // The single behind them does not queue-jump into the free seat.
    expect(first?.status).toBe("waitlisted");
    expect(second?.status).toBe("waitlisted");
    expect(first?.waitlistRank).toBe(1);
    expect(second?.waitlistRank).toBe(2);
  });
});

describe("concurrency", () => {
  it("never oversells when everyone RSVPs at once", async () => {
    const capacity = 3;
    const { instance } = await makeEvent({ capacity });

    // Eight people, three seats, all submitting simultaneously. Without the
    // row lock in submitRsvp they would all read "seats available".
    const outcomes = await Promise.all(
      guests.map((guest) =>
        submitRsvp({
          instanceId: instance.id,
          userId: guest.id,
          status: "going",
          guestCount: 0,
        }),
      ),
    );

    const rows = await prisma.eventRsvp.findMany({ where: { instanceId: instance.id } });
    const going = rows.filter((row) => row.status === "going");
    const waitlisted = rows.filter((row) => row.status === "waitlisted");

    expect(going).toHaveLength(capacity);
    expect(waitlisted).toHaveLength(guests.length - capacity);
    expect(outcomes).toHaveLength(guests.length);

    // Waitlist positions are a clean 1..n with no duplicates and no gaps.
    const ranks = waitlisted.map((row) => row.waitlistRank).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(ranks).toEqual(Array.from({ length: waitlisted.length }, (_, index) => index + 1));
  });

  it("does not create a duplicate RSVP when the same person submits twice at once", async () => {
    const { instance } = await makeEvent({ capacity: 10 });

    await Promise.all([
      submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 0 }),
      submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 0 }),
    ]);

    const rows = await prisma.eventRsvp.findMany({
      where: { instanceId: instance.id, userId: guests[0].id },
    });

    expect(rows).toHaveLength(1);
  });
});

describe("closed occurrences", () => {
  it("rejects an RSVP to a cancelled occurrence", async () => {
    const { instance } = await makeEvent({ capacity: null });
    await cancelInstance(instance.id, host.id);

    await expect(
      submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 0 }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects an RSVP once the series is cancelled", async () => {
    const { series, instance } = await makeEvent({ capacity: null });
    await cancelSeries(series.id, host.id, { scope: "all" });

    await expect(
      submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: 0 }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects a negative guest count", async () => {
    const { instance } = await makeEvent({ capacity: null });

    await expect(
      submitRsvp({ instanceId: instance.id, userId: guests[0].id, status: "going", guestCount: -1 }),
    ).rejects.toMatchObject({ code: "invalid" });
  });
});
