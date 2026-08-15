import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildInstances, type RecurrenceRuleInput } from "../src/lib/domain/recurrence";
import { eventImagePool } from "../src/lib/domain/event-images";

/**
 * Seed data for local work and for the release gate that requires examples of
 * every state: recurring events, capacity limits, a full event with a waitlist,
 * a cancelled occurrence, and RSVPs in each status.
 *
 * Safe to re-run. Every write is keyed on a stable id or a unique column, so a
 * second run updates rather than duplicates.
 */

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set to seed.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const TIMEZONE = "America/New_York";

type SeedUser = { key: string; email: string; name: string; username: string };

const users: SeedUser[] = [
  { key: "lana", email: "lana@example.com", name: "Lana Yepifanova", username: "lana" },
  { key: "maya", email: "maya@example.com", name: "Maya Chen", username: "maya" },
  { key: "theo", email: "theo@example.com", name: "Theo Ramirez", username: "theo" },
  { key: "nina", email: "nina@example.com", name: "Nina Patel", username: "nina" },
  { key: "amara", email: "amara@example.com", name: "Amara Lewis", username: "amara" },
  { key: "sofia", email: "sofia@example.com", name: "Sofia Marin", username: "sofia" },
  { key: "julian", email: "julian@example.com", name: "Julian Brooks", username: "julian" },
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
};

const events: SeedEvent[] = [
  {
    slug: "weekly-run-club",
    host: "maya",
    title: "Weekly Run Club",
    description: "A relaxed loop through the park with water breaks, stretching, and coffee after.",
    locationName: "Riverside Park",
    startOffsetDays: 3,
    startTime: "18:30",
    durationMinutes: 60,
    capacity: null,
    waitlistEnabled: true,
    recurrence: { freq: "weekly", interval: 1, byDay: ["MO"] },
  },
  {
    slug: "founders-dinner",
    host: "theo",
    title: "Founders Dinner",
    description:
      "A small table for people building new things to trade notes, introductions, and half-formed ideas.",
    locationName: "The Long Table",
    startOffsetDays: 5,
    startTime: "20:00",
    // Deliberately tiny: this is the event the waitlist tests and the capacity
    // UI states are demonstrated on.
    durationMinutes: 120,
    capacity: 4,
    waitlistEnabled: true,
    recurrence: { freq: "weekly", interval: 2, byDay: ["TH"] },
  },
  {
    slug: "saturday-market-walk",
    host: "nina",
    title: "Saturday Market Walk",
    description: "Meet at the north entrance and wander the stalls together for flowers and breakfast.",
    locationName: "Union Market",
    startOffsetDays: 2,
    startTime: "10:00",
    durationMinutes: 90,
    capacity: 12,
    waitlistEnabled: true,
    recurrence: { freq: "weekly", interval: 1, byDay: ["SA"] },
  },
  {
    slug: "design-crit",
    host: "lana",
    title: "Design Crit",
    description:
      "Bring one screen, one flow, or one messy problem. The group gives direct notes and useful references.",
    locationName: "Studio 4",
    startOffsetDays: 6,
    startTime: "17:00",
    durationMinutes: 90,
    capacity: 8,
    // The one event with the waitlist off, so the "full, turned away" path has
    // somewhere to be seen.
    waitlistEnabled: false,
    recurrence: { freq: "weekly", interval: 2, byDay: ["WE"] },
  },
  {
    slug: "neighborhood-coffee",
    host: "lana",
    title: "Neighborhood Coffee",
    description: "A standing morning coffee for neighbors, friends, and anyone new nearby.",
    locationName: "Corner Cafe",
    startOffsetDays: 9,
    startTime: "09:00",
    durationMinutes: 60,
    capacity: null,
    waitlistEnabled: true,
    recurrence: { freq: "monthly", interval: 1, byDay: ["FR"], bySetPosition: [1] },
  },
  {
    slug: "book-swap",
    host: "lana",
    title: "Book Swap",
    description:
      "Bring a book you liked, take one home, and stay for a short conversation about what everyone is reading.",
    locationName: "The Reading Room",
    startOffsetDays: 14,
    startTime: "15:00",
    durationMinutes: 120,
    capacity: 20,
    waitlistEnabled: true,
    recurrence: { freq: "monthly", interval: 1, byMonthDay: [15] },
  },
  {
    slug: "gallery-opening",
    host: "amara",
    title: "Gallery Opening",
    description: "An evening opening with new photography, soft music, and a few familiar faces.",
    locationName: "North Gallery",
    startOffsetDays: -7,
    startTime: "19:00",
    durationMinutes: 180,
    capacity: 40,
    waitlistEnabled: true,
    recurrence: { freq: "monthly", interval: 3 },
  },
  {
    slug: "morning-yoga",
    host: "sofia",
    title: "Morning Yoga",
    description: "A gentle outdoor class focused on breath, balance, and waking up slowly.",
    locationName: "The Green",
    startOffsetDays: -10,
    startTime: "08:00",
    durationMinutes: 60,
    capacity: 15,
    waitlistEnabled: true,
    recurrence: { freq: "weekly", interval: 1, byDay: ["SU"] },
  },
  {
    slug: "community-potluck",
    host: "julian",
    title: "Community Potluck",
    description:
      "A casual shared meal where everyone brings something simple and leaves with new names.",
    locationName: "Community Hall",
    startOffsetDays: -30,
    startTime: "18:00",
    durationMinutes: 150,
    capacity: 50,
    waitlistEnabled: true,
    recurrence: { freq: "monthly", interval: 1 },
  },
];

async function main() {
  console.log("Seeding Matane…");

  const userIds = new Map<string, string>();

  for (const user of users) {
    // Seeded users have no Supabase identity, so their ids are generated here.
    // A real sign-in with the same email adopts the row by email lookup.
    const existing = await prisma.user.findUnique({ where: { email: user.email } });

    const row = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        id: existing?.id ?? randomUUID(),
        email: user.email,
        name: user.name,
        username: user.username,
      },
      update: { name: user.name, username: user.username },
    });

    userIds.set(user.key, row.id);
  }

  console.log(`  ${users.length} users`);

  const seriesIds = new Map<string, string>();

  for (const [index, event] of events.entries()) {
    const organizerId = userIds.get(event.host)!;
    const startsAtLocal = `${offsetDate(event.startOffsetDays)}T${event.startTime}`;

    const occurrences = buildInstances({
      startsAtLocal,
      durationMinutes: event.durationMinutes,
      timezone: TIMEZONE,
      recurrence: event.recurrence,
      limit: 12,
      through: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

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
        status: "active",
      },
      update: {
        title: event.title,
        description: event.description,
        locationName: event.locationName,
        capacity: event.capacity,
        waitlistEnabled: event.waitlistEnabled,
        startsAtLocal,
        recurrenceRule: event.recurrence,
      },
    });

    seriesIds.set(event.slug, seriesId);

    for (const occurrence of occurrences) {
      await prisma.eventInstance.upsert({
        where: { seriesId_startsAt: { seriesId, startsAt: new Date(occurrence.startsAt) } },
        create: {
          seriesId,
          startsAt: new Date(occurrence.startsAt),
          endsAt: new Date(occurrence.endsAt),
          localDate: occurrence.localDate,
        },
        update: {},
      });
    }
  }

  console.log(`  ${events.length} event series with occurrences`);

  await seedRsvps(userIds, seriesIds);
  await seedCancelledOccurrence(seriesIds);
  await seedNotificationPreferences(userIds);

  console.log("Done.");
}

/**
 * Fills the Founders Dinner to capacity and pushes two people onto the
 * waitlist, so the capacity-full and waitlisted states are visible without
 * anyone having to reproduce them by hand.
 */
async function seedRsvps(userIds: Map<string, string>, seriesIds: Map<string, string>) {
  const dinner = await nextInstance(seriesIds.get("founders-dinner")!);
  const market = await nextInstance(seriesIds.get("saturday-market-walk")!);
  const yoga = await pastInstance(seriesIds.get("morning-yoga")!);
  const potluck = await pastInstance(seriesIds.get("community-potluck")!);

  if (dinner) {
    // Capacity is 4: Maya brings a guest (2 seats), Nina takes the 3rd, Lana
    // takes the 4th. Theo and Amara then land on the waitlist in order.
    await rsvp(dinner.id, userIds.get("maya")!, "going", 1, 2, null);
    await rsvp(dinner.id, userIds.get("nina")!, "going", 0, 1, null);
    await rsvp(dinner.id, userIds.get("lana")!, "going", 0, 1, null);
    await rsvp(dinner.id, userIds.get("theo")!, "waitlisted", 0, 1, 1);
    await rsvp(dinner.id, userIds.get("amara")!, "waitlisted", 1, 2, 2);
  }

  if (market) {
    await rsvp(market.id, userIds.get("lana")!, "going", 2, 3, null);
    await rsvp(market.id, userIds.get("sofia")!, "maybe", 0, 0, null);
    await rsvp(market.id, userIds.get("julian")!, "busy", 0, 0, null);
  }

  // Past attendance, so "Events you attended" is not empty on a fresh database.
  if (yoga) {
    await rsvp(yoga.id, userIds.get("lana")!, "going", 0, 1, null);
    await rsvp(yoga.id, userIds.get("nina")!, "going", 0, 1, null);
  }

  if (potluck) {
    await rsvp(potluck.id, userIds.get("lana")!, "going", 1, 2, null);
  }

  console.log("  RSVPs across going, maybe, busy, and waitlisted");
}

/** One cancelled occurrence, so the cancelled state has a real example. */
async function seedCancelledOccurrence(seriesIds: Map<string, string>) {
  const coffee = seriesIds.get("neighborhood-coffee");
  if (!coffee) return;

  const instances = await prisma.eventInstance.findMany({
    where: { seriesId: coffee, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    skip: 1,
    take: 1,
  });

  if (instances[0]) {
    await prisma.eventInstance.update({
      where: { id: instances[0].id },
      data: { status: "cancelled" },
    });
    console.log("  1 cancelled occurrence");
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
