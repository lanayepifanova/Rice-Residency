import type { EventInstance, EventSeries } from "@prisma/client";
import { prisma } from "@/lib/db";
import { coverImageFor } from "@/lib/domain/event-images";
import { formatShort } from "@/lib/domain/format";

export type EventCard = {
  seriesId: string;
  instanceId: string;
  title: string;
  meta: string;
  image: string;
  href: string;
  cancelled: boolean;
};

type Row = EventInstance & { series: EventSeries };

function toCard(row: Row): EventCard {
  return {
    seriesId: row.seriesId,
    instanceId: row.id,
    title: row.overrideTitle ?? row.series.title,
    meta: formatShort(row.startsAt, row.series.timezone),
    image: coverImageFor(row.seriesId, row.series.coverImage),
    href: `/events/${row.seriesId}/${row.id}`,
    cancelled: row.status === "cancelled" || row.series.status === "cancelled",
  };
}

/**
 * Lists show one card per event, not one per occurrence — a weekly run club
 * would otherwise fill the whole grid with itself. The occurrence kept is the
 * one nearest the present, which is the one a visitor can act on.
 */
function firstPerSeries(rows: Row[]): Row[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.seriesId)) {
      return false;
    }
    seen.add(row.seriesId);
    return true;
  });
}

/** Public events open to anyone, soonest first. */
export async function upcomingPublicEvents(options: {
  excludeOrganizerId?: string;
  take?: number;
} = {}): Promise<EventCard[]> {
  const rows = await prisma.eventInstance.findMany({
    where: {
      startsAt: { gte: new Date() },
      status: "scheduled",
      series: {
        status: "active",
        visibility: "public",
        ...(options.excludeOrganizerId ? { organizerId: { not: options.excludeOrganizerId } } : {}),
      },
    },
    include: { series: true },
    orderBy: { startsAt: "asc" },
    take: (options.take ?? 12) * 6,
  });

  return firstPerSeries(rows)
    .slice(0, options.take ?? 12)
    .map(toCard);
}

/** Everything this user hosts, upcoming occurrence first. */
export async function hostedEvents(userId: string, take = 12): Promise<EventCard[]> {
  const rows = await prisma.eventInstance.findMany({
    where: { series: { organizerId: userId } },
    include: { series: true },
    orderBy: { startsAt: "asc" },
    take: take * 8,
  });

  const now = Date.now();
  // A host cares about the next occurrence of each event; only once every
  // occurrence is behind them does the most recent past one become the useful
  // thing to show.
  const upcoming = rows.filter((row) => row.startsAt.getTime() >= now);
  const past = rows.filter((row) => row.startsAt.getTime() < now).reverse();

  return firstPerSeries([...upcoming, ...past])
    .slice(0, take)
    .map(toCard);
}

/** Past occurrences this user said they were going to. */
export async function attendedEvents(userId: string, take = 12): Promise<EventCard[]> {
  const rsvps = await prisma.eventRsvp.findMany({
    where: {
      userId,
      status: "going",
      instance: { startsAt: { lt: new Date() } },
    },
    include: { instance: { include: { series: true } } },
    orderBy: { instance: { startsAt: "desc" } },
    take: take * 6,
  });

  return firstPerSeries(rsvps.map((rsvp) => rsvp.instance))
    .slice(0, take)
    .map(toCard);
}

/** Upcoming occurrences this user has answered going or maybe. */
export async function attendingEvents(userId: string, take = 12): Promise<EventCard[]> {
  const rsvps = await prisma.eventRsvp.findMany({
    where: {
      userId,
      status: { in: ["going", "maybe", "waitlisted"] },
      instance: { startsAt: { gte: new Date() }, status: { not: "cancelled" } },
    },
    include: { instance: { include: { series: true } } },
    orderBy: { instance: { startsAt: "asc" } },
    take: take * 6,
  });

  return firstPerSeries(rsvps.map((rsvp) => rsvp.instance))
    .slice(0, take)
    .map(toCard);
}

export type ExploreFilter = "all" | "week" | "month" | "open";

/** The explore grid: every public occurrence, optionally narrowed by date. */
export async function exploreEvents(filter: ExploreFilter = "all", take = 48): Promise<EventCard[]> {
  const now = new Date();
  const horizon = new Date(now);

  if (filter === "week") horizon.setDate(horizon.getDate() + 7);
  if (filter === "month") horizon.setMonth(horizon.getMonth() + 1);

  const rows = await prisma.eventInstance.findMany({
    where: {
      startsAt: {
        gte: now,
        ...(filter === "week" || filter === "month" ? { lte: horizon } : {}),
      },
      status: "scheduled",
      series: {
        status: "active",
        visibility: "public",
        ...(filter === "open" ? { capacity: null } : {}),
      },
    },
    include: { series: true },
    orderBy: { startsAt: "asc" },
    take: take * 4,
  });

  return firstPerSeries(rows).slice(0, take).map(toCard);
}
