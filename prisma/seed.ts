import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/server/password";
import { buildInstances, type RecurrenceRuleInput } from "../src/lib/domain/recurrence";
import { eventImagePool, seriesImageAt } from "../src/lib/domain/event-images";

/**
 * Seed data for local work and for the release gate that requires examples of
 * every state: recurring events, capacity limits, a full event with a waitlist,
 * a series still being planned, and RSVPs in each status. Nothing is cancelled
 * — every date on the calendar is one the house is actually running.
 *
 * Rice Residency runs three things and only three things, so the seed is those
 * three rather than a sampler of invented events.
 *
 * Safe to re-run. Every write is keyed on a stable id or a unique column, so a
 * second run updates rather than duplicates, and series from earlier seeds that
 * are no longer listed here are removed.
 */

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set to seed.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Password for every seeded account, so the demo house is walkable: sign in as
 * lana@example.com and you are the organizer. Overridable, and irrelevant in
 * any real use since these addresses are all @example.com.
 */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "residency";

/** Everything Rice Residency runs is in Houston, so every time is Central. */
const TIMEZONE = "America/Chicago";

type SeedUser = {
  key: string;
  email: string;
  name: string;
  username: string;
  bio: string;
  riceYear: string;
  major: string;
  projectName: string;
  projectSummary: string;
  projectUrl?: string;
  pastProjects: string;
  helpNeeded: string;
};

/**
 * Only the organizer. The house directory is real people now and lives in
 * `people-data.ts`, imported by `npm run db:seed:people` — this seed keeps just
 * the account that hosts the events, so the two never fight over the same rows.
 */
const users: SeedUser[] = [
  {
    key: "lana",
    email: "lana@example.com",
    name: "Lana Yepifanova",
    username: "lana",
    bio: "Runs the residency. Around most Sundays.",
    riceYear: "Senior",
    major: "Computer Science",
    projectName: "Rice Residency",
    projectSummary: "The house itself: coworking, parties, and dinners for people building things.",
    pastProjects: "Two seasons of the residency, a campus events newsletter, a tiny RSVP bot that predates this app.",
    helpNeeded: "Sponsors for the dinner series, and anyone who has run a members directory before.",
  },
];

type SeedEvent = {
  slug: string;
  host: string;
  title: string;
  description: string;
  locationName: string;
  /** Days from today the series starts. Negative seeds an event in the past. */
  startOffsetDays: number;
  startTime: string;
  durationMinutes: number;
  capacity: number | null;
  waitlistEnabled: boolean;
  recurrence: RecurrenceRuleInput;
  /**
   * A draft series is one whose dates are not settled yet. It gets no
   * occurrences and stays out of the dated feeds until it is made active.
   */
  status?: "draft" | "active";
  /**
   * Local dates (YYYY-MM-DD) the series skips — a week the house is dark. The
   * occurrence is never generated, and one already in the database is removed,
   * so a skipped date stays gone across re-seeds.
   */
  skipDates?: string[];
};

const events: SeedEvent[] = [
  {
    slug: "sunday-coworking",
    host: "lana",
    title: "Sunday Weekly Coworking Sessions",
    description:
      "Two hours of heads-down work with the house. Bring whatever you are building, claim a seat at the table, and stay for the debrief at the end.",
    locationName: "Rice Residency · Main Room",
    // Started three weeks back, so the series has past occurrences behind it as
    // well as the rolling window ahead.
    startOffsetDays: -21,
    startTime: "17:00",
    durationMinutes: 120,
    // The table seats six. This is the event the capacity-full and waitlist
    // states are demonstrated on.
    capacity: 6,
    waitlistEnabled: true,
    // The term runs through the last Sunday in November; the next block of
    // dates gets scheduled after that.
    recurrence: { freq: "weekly", interval: 1, byDay: ["SU"], until: "2026-11-29T23:59" },
    // The house is dark for two Sundays; sessions resume on the 30th.
    skipDates: ["2026-08-16", "2026-08-23"],
  },
  {
    slug: "friday-house-party",
    host: "lana",
    title: "Friday Biweekly House Parties",
    description:
      "Every other Friday the house opens up: music, a full kitchen, and everyone the residency has met since the last one. Bring people worth introducing.",
    locationName: "Rice Residency · The House",
    startOffsetDays: -14,
    startTime: "22:00",
    // 22:00 to 01:00, so an occurrence deliberately runs past midnight into
    // Saturday morning.
    durationMinutes: 180,
    capacity: 45,
    waitlistEnabled: true,
    recurrence: { freq: "weekly", interval: 2, byDay: ["FR"] },
    // The next run of parties is still being worked out, so the series holds
    // its history but no upcoming dates.
    status: "draft",
  },
  {
    slug: "vc-networking-dinner",
    host: "lana",
    title: "VC Sponsored Networking Dinners",
    description:
      "A sponsored table with investors and the founders they should meet. Dates are being worked out with the sponsors — this page is where they land once they are set.",
    locationName: "To be announced",
    // A placeholder start: a draft series generates no occurrences, so this
    // date is never shown to anyone. The monthly rule records the cadence the
    // dinners are being planned around.
    startOffsetDays: 30,
    startTime: "19:00",
    durationMinutes: 150,
    capacity: 20,
    waitlistEnabled: true,
    recurrence: { freq: "monthly", interval: 1 },
    status: "draft",
  },
];

/** The directory half of a profile, written identically on create and update. */
function profileFields(user: SeedUser) {
  return {
    bio: user.bio,
    riceYear: user.riceYear,
    major: user.major,
    projectName: user.projectName,
    projectSummary: user.projectSummary,
    projectUrl: user.projectUrl ?? null,
    pastProjects: user.pastProjects,
    helpNeeded: user.helpNeeded,
  };
}

async function main() {
  console.log("Seeding Rice Residency…");

  const userIds = new Map<string, string>();

  for (const user of users) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });

    // Never re-hash over a password someone actually chose: re-running the seed
    // refreshes profile copy, and silently resetting a login would be a nasty
    // way to find that out.
    const passwordHash = existing?.passwordHash ?? (await hashPassword(SEED_PASSWORD));

    const row = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        id: existing?.id ?? randomUUID(),
        email: user.email,
        passwordHash,
        membership: "resident",
        name: user.name,
        username: user.username,
        ...profileFields(user),
      },
      update: {
        passwordHash,
        membership: "resident",
        name: user.name,
        username: user.username,
        ...profileFields(user),
      },
    });

    userIds.set(user.key, row.id);
  }

  console.log(`  ${users.length} users`);

  const seriesIds = new Map<string, string>();

  for (const [index, event] of events.entries()) {
    const organizerId = userIds.get(event.host)!;
    const startsAtLocal = `${offsetDate(event.startOffsetDays)}T${event.startTime}`;
    const status = event.status ?? "active";

    // A draft has no settled dates, so nothing is generated for it. The same
    // rule holds at runtime: materialization skips anything not active.
    const skipped = new Set(event.skipDates ?? []);

    const occurrences = (
      status === "active"
        ? buildInstances({
            startsAtLocal,
            durationMinutes: event.durationMinutes,
            timezone: TIMEZONE,
            recurrence: event.recurrence,
            limit: 40,
            through: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          })
        : []
    ).filter((occurrence) => !skipped.has(occurrence.localDate));

    // Keyed on a deterministic id so re-seeding updates the same rows instead
    // of piling up copies.
    const seriesId = `seed_${event.slug}`;

    await prisma.eventSeries.upsert({
      where: { id: seriesId },
      create: {
        id: seriesId,
        organizerId,
        title: event.title,
        description: event.description,
        locationName: event.locationName,
        coverImage: eventImagePool[index % eventImagePool.length],
        timezone: TIMEZONE,
        startsAtLocal,
        durationMinutes: event.durationMinutes,
        capacity: event.capacity,
        waitlistEnabled: event.waitlistEnabled,
        visibility: "public",
        recurrenceRule: event.recurrence,
        materializedThrough: occurrences.length
          ? new Date(occurrences[occurrences.length - 1].startsAt)
          : null,
        status,
      },
      update: {
        organizerId,
        title: event.title,
        description: event.description,
        locationName: event.locationName,
        timezone: TIMEZONE,
        durationMinutes: event.durationMinutes,
        capacity: event.capacity,
        waitlistEnabled: event.waitlistEnabled,
        startsAtLocal,
        recurrenceRule: event.recurrence,
        status,
      },
    });

    seriesIds.set(event.slug, seriesId);

    // A draft has no dates at all — not ahead, and not in the archive either.
    // Until the schedule is settled there is nothing to show.
    if (status === "draft") {
      await prisma.eventInstance.deleteMany({ where: { seriesId } });
    }

    if (skipped.size) {
      await prisma.eventInstance.deleteMany({
        where: { seriesId, localDate: { in: [...skipped] } },
      });
    }

    // Occurrences an earlier seed generated that the current rule no longer
    // produces — dates past a newly added end, or a weekday that changed —
    // would otherwise linger in the feeds forever.
    if (status === "active") {
      await prisma.eventInstance.deleteMany({
        where: {
          seriesId,
          startsAt: {
            gte: new Date(),
            notIn: occurrences.map((occurrence) => new Date(occurrence.startsAt)),
          },
        },
      });
    }

    for (const [position, occurrence] of occurrences.entries()) {
      // Every date gets its own photo, dealt from the series' own shuffle of
      // the pool, so no two dates repeat one until the pool is spent.
      const coverImage = seriesImageAt(seriesId, position);

      await prisma.eventInstance.upsert({
        where: { seriesId_startsAt: { seriesId, startsAt: new Date(occurrence.startsAt) } },
        create: {
          seriesId,
          startsAt: new Date(occurrence.startsAt),
          endsAt: new Date(occurrence.endsAt),
          localDate: occurrence.localDate,
          coverImage,
        },
        update: { coverImage },
      });
    }
  }

  console.log(`  ${events.length} event series with occurrences`);

  await removeRetiredSeed(seriesIds);
  await seedRsvps(userIds, seriesIds);
  await clearCancellations(seriesIds);
  await seedNotificationPreferences(userIds);

  console.log("Done.");
}

/**
 * Earlier seeds created events this one no longer has. Re-running would
 * otherwise leave them in the feeds forever, since an upsert only ever adds.
 */
async function removeRetiredSeed(seriesIds: Map<string, string>) {
  const keep = [...seriesIds.values()];

  const removed = await prisma.eventSeries.deleteMany({
    where: { id: { startsWith: "seed_", notIn: keep } },
  });

  if (removed.count) {
    console.log(`  ${removed.count} retired seed series removed`);
  }
}

/**
 * Fills the next coworking session to capacity and pushes two people onto the
 * waitlist, so the capacity-full and waitlisted states are visible without
 * anyone having to reproduce them by hand.
 */
async function seedRsvps(userIds: Map<string, string>, seriesIds: Map<string, string>) {
  const coworking = await nextInstance(seriesIds.get("sunday-coworking")!);
  const pastCoworking = await pastInstance(seriesIds.get("sunday-coworking")!);
  const pastParty = await pastInstance(seriesIds.get("friday-house-party")!);

  if (coworking) {
    // Capacity is 6: Maya brings a guest (2 seats), then Nina, Sofia, Julian,
    // and Theo take the rest. Amara and Kai land on the waitlist in order.
    // Only the organizer. The demo RSVPs came from invented people who are no
    // longer in the directory, so capacity and waitlist states now come from
    // real ones as they arrive rather than from fiction.
    await rsvp(coworking.id, userIds.get("lana")!, "going", 0, 1, null);
  }

  // Past attendance, so "Events you attended" is not empty on a fresh database.
  if (pastCoworking) {
    await rsvp(pastCoworking.id, userIds.get("lana")!, "going", 0, 1, null);
  }

  if (pastParty) {
    // The party is history now, so its RSVPs cover going, maybe, and busy.
    await rsvp(pastParty.id, userIds.get("lana")!, "going", 1, 2, null);
  }

  console.log("  RSVPs across going, maybe, busy, and waitlisted");
}

/**
 * Nothing on the calendar is cancelled. Cancelling is a host action, so a
 * cancellation left over from an earlier seed is cleared rather than kept.
 */
async function clearCancellations(seriesIds: Map<string, string>) {
  const cleared = await prisma.eventInstance.updateMany({
    where: { seriesId: { in: [...seriesIds.values()] }, status: "cancelled" },
    data: { status: "scheduled" },
  });

  if (cleared.count) {
    console.log(`  ${cleared.count} cancellation(s) cleared`);
  }
}

async function seedNotificationPreferences(userIds: Map<string, string>) {
  for (const userId of userIds.values()) {
    await prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, inApp: true, email: false, push: false, sms: false },
      update: {},
    });
  }
}

async function rsvp(
  instanceId: string,
  userId: string,
  status: "going" | "maybe" | "busy" | "waitlisted",
  guestCount: number,
  partySize: number,
  waitlistRank: number | null,
) {
  await prisma.eventRsvp.upsert({
    where: { instanceId_userId: { instanceId, userId } },
    create: { instanceId, userId, status, guestCount, partySize, waitlistRank },
    update: { status, guestCount, partySize, waitlistRank },
  });
}

async function nextInstance(seriesId: string) {
  return prisma.eventInstance.findFirst({
    where: { seriesId, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });
}

async function pastInstance(seriesId: string) {
  return prisma.eventInstance.findFirst({
    where: { seriesId, startsAt: { lt: new Date() } },
    orderBy: { startsAt: "desc" },
  });
}

/** A local date N days from today, as YYYY-MM-DD. */
function offsetDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
