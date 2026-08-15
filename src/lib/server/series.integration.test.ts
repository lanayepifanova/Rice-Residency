import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  cancelInstance,
  cancelSeries,
  createSeries,
  listInstances,
  materializeSeries,
  SeriesError,
  updateInstance,
  updateSeries,
} from "./series";
import { cleanupTestData, createTestUser, localDaysFromNow } from "./test-helpers";

let host: User;
let stranger: User;

beforeAll(async () => {
  host = await createTestUser("host");
  stranger = await createTestUser("stranger");
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

function weeklyInput(overrides: Partial<Parameters<typeof createSeries>[1]> = {}) {
  return {
    title: "Integration Run Club",
    description: "Meet by the entrance.",
    timezone: "America/New_York",
    startsAtLocal: localDaysFromNow(2),
    durationMinutes: 60,
    capacity: null,
    inviteEmails: [],
    waitlistEnabled: true,
    visibility: "public" as const,
    recurrence: { freq: "weekly" as const, interval: 1 },
    ...overrides,
  };
}

describe("createSeries", () => {
  it("persists the series and its occurrences", async () => {
    const series = await createSeries(host.id, weeklyInput());

    expect(series.id).toBeTruthy();
    expect(series.instances.length).toBeGreaterThan(10);

    const stored = await prisma.eventSeries.findUnique({ where: { id: series.id } });
    expect(stored?.title).toBe("Integration Run Club");
    // The wall-clock start survives the round trip as text, not as an instant.
    expect(stored?.startsAtLocal).toBe(weeklyInput().startsAtLocal);

    const gaps = series.instances
      .slice(1)
      .map((instance, index) => instance.startsAt.getTime() - series.instances[index].startsAt.getTime());

    // A week apart in wall-clock terms. Across a DST boundary the real elapsed
    // time is an hour more or less than 168 hours, which is the point: the
    // local time is what stays fixed, not the duration.
    const week = 7 * 86_400_000;
    const hour = 3_600_000;

    for (const gap of gaps) {
      expect([week - hour, week, week + hour]).toContain(gap);
    }
  });

  it("rejects a recurrence that produces nothing", async () => {
    await expect(
      createSeries(
        host.id,
        weeklyInput({
          startsAtLocal: localDaysFromNow(10),
          recurrence: { freq: "weekly", interval: 1, until: localDaysFromNow(1) },
        }),
      ),
    ).rejects.toBeInstanceOf(SeriesError);
  });

  it("stores invites for people who do not have an account yet", async () => {
    const series = await createSeries(
      host.id,
      weeklyInput({ inviteEmails: ["Nobody@Example.com", "nobody@example.com"] }),
    );

    const invites = await prisma.eventInvite.findMany({ where: { seriesId: series.id } });

    // Deduplicated and lowercased, so one person cannot occupy two invite rows.
    expect(invites).toHaveLength(1);
    expect(invites[0].email).toBe("nobody@example.com");
  });

  it("never generates past the ten-year cap", async () => {
    const series = await createSeries(
      host.id,
      weeklyInput({ recurrence: { freq: "yearly", interval: 1 } }),
    );

    // Repeatedly topping up must still respect the ceiling.
    for (let round = 0; round < 3; round += 1) {
      await materializeSeries(series.id);
    }

    const instances = await listInstances(series.id, { take: 500 });
    const ceiling = new Date();
    ceiling.setFullYear(ceiling.getFullYear() + 10);
    ceiling.setDate(ceiling.getDate() + 2);

    for (const instance of instances) {
      expect(instance.startsAt.getTime()).toBeLessThanOrEqual(ceiling.getTime());
    }
  });
});

describe("materializeSeries", () => {
  it("is idempotent, so repeated reads never duplicate occurrences", async () => {
    const series = await createSeries(host.id, weeklyInput());
    const before = await prisma.eventInstance.count({ where: { seriesId: series.id } });

    await Promise.all([
      materializeSeries(series.id),
      materializeSeries(series.id),
      materializeSeries(series.id),
    ]);

    const after = await prisma.eventInstance.count({ where: { seriesId: series.id } });
    expect(after).toBe(before);
  });
});

describe("authorization", () => {
  it("refuses edits from anyone but the host", async () => {
    const series = await createSeries(host.id, weeklyInput());

    await expect(
      updateSeries(series.id, stranger.id, { scope: "all", title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      cancelSeries(series.id, stranger.id, { scope: "all" }),
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      cancelInstance(series.instances[0].id, stranger.id),
    ).rejects.toMatchObject({ code: "forbidden" });

    await expect(
      updateInstance(series.instances[0].id, stranger.id, { title: "Hijacked" }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const untouched = await prisma.eventSeries.findUnique({ where: { id: series.id } });
    expect(untouched?.title).toBe("Integration Run Club");
    expect(untouched?.status).toBe("active");
  });
});

describe("scoped edits", () => {
  it("applies a this-occurrence edit as an override, leaving the series alone", async () => {
    const series = await createSeries(host.id, weeklyInput());
    const target = series.instances[1];

    await updateInstance(target.id, host.id, { title: "Just this week: hill repeats" });

    const edited = await prisma.eventInstance.findUnique({ where: { id: target.id } });
    const sibling = await prisma.eventInstance.findUnique({
      where: { id: series.instances[2].id },
    });
    const parent = await prisma.eventSeries.findUnique({ where: { id: series.id } });

    expect(edited?.overrideTitle).toBe("Just this week: hill repeats");
    expect(sibling?.overrideTitle).toBeNull();
    expect(parent?.title).toBe("Integration Run Club");
  });

  it("applies an all-occurrences edit to the series and clears overrides", async () => {
    const series = await createSeries(host.id, weeklyInput());
    await updateInstance(series.instances[1].id, host.id, { title: "One-off name" });

    await updateSeries(series.id, host.id, { scope: "all", title: "Renamed Club" });

    const parent = await prisma.eventSeries.findUnique({ where: { id: series.id } });
    const previouslyOverridden = await prisma.eventInstance.findUnique({
      where: { id: series.instances[1].id },
    });

    expect(parent?.title).toBe("Renamed Club");
    // A series-wide rename is authoritative, so the override no longer shadows it.
    expect(previouslyOverridden?.overrideTitle).toBeNull();
  });

  it("splits the series on a future-scoped edit and keeps earlier occurrences intact", async () => {
    const series = await createSeries(host.id, weeklyInput());
    const cutoff = series.instances[2];
    const before = series.instances.slice(0, 2).map((instance) => instance.id);

    const result = await updateSeries(series.id, host.id, {
      scope: "future",
      fromInstanceId: cutoff.id,
      title: "New Direction",
    });

    expect(result.splitSeriesId).toBeTruthy();

    const original = await prisma.eventSeries.findUnique({ where: { id: series.id } });
    const created = await prisma.eventSeries.findUnique({
      where: { id: result.splitSeriesId! },
    });

    expect(original?.title).toBe("Integration Run Club");
    expect(created?.title).toBe("New Direction");

    // Occurrences before the cutoff stay on the original series untouched.
    const survivors = await prisma.eventInstance.findMany({
      where: { id: { in: before } },
    });
    expect(survivors).toHaveLength(2);

    // The cutoff occurrence moved to the new series.
    const oldCutoff = await prisma.eventInstance.findUnique({ where: { id: cutoff.id } });
    expect(oldCutoff).toBeNull();

    const newInstances = await listInstances(result.splitSeriesId!, { take: 5 });
    expect(newInstances.length).toBeGreaterThan(0);
  });
});

describe("cancellation", () => {
  it("cancels a single occurrence without touching the rest", async () => {
    const series = await createSeries(host.id, weeklyInput());

    await cancelInstance(series.instances[0].id, host.id);

    const cancelled = await prisma.eventInstance.findUnique({
      where: { id: series.instances[0].id },
    });
    const next = await prisma.eventInstance.findUnique({
      where: { id: series.instances[1].id },
    });
    const parent = await prisma.eventSeries.findUnique({ where: { id: series.id } });

    expect(cancelled?.status).toBe("cancelled");
    expect(next?.status).toBe("scheduled");
    expect(parent?.status).toBe("active");
  });

  it("cancels the whole series when asked", async () => {
    const series = await createSeries(host.id, weeklyInput());

    await cancelSeries(series.id, host.id, { scope: "all" });

    const parent = await prisma.eventSeries.findUnique({ where: { id: series.id } });
    const instances = await listInstances(series.id, { take: 200 });

    expect(parent?.status).toBe("cancelled");
    expect(instances.every((instance) => instance.status === "cancelled")).toBe(true);
  });
});
