import type { EventInstance, EventSeries } from "@prisma/client";
import { prisma } from "@/lib/db";
import { coverImageFor } from "@/lib/domain/event-images";
import { formatDateLabel, formatShort, formatTimeRange, timezoneLabel } from "@/lib/domain/format";

export type EventCard = {
  seriesId: string;
  /** Null for a series whose dates are not settled yet: there is no occurrence
   * to point at, so the card links to the series itself. */
  instanceId: string | null;
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

/**
 * One series and the dates under it. The home page is organised by series
 * rather than by date, because Rice Residency runs a handful of standing
 * events and "when is the next coworking session" is the question being asked,
 * not "what is happening next" across everything at once.
 */
export type SeriesSection = {
  seriesId: string;
  title: string;
  /** Null when the title already says the cadence, which is the usual case. */
  summary: string | null;
  href: string;
  /** True when the dates are not settled yet, so there is nothing to list. */
  planned: boolean;
  events: EventCard[];
};

/**
 * How many dates a series section lists. A series with an end date shows its
 * whole remaining run; this only bounds an open-ended one so the grid cannot
 * grow without limit.
 */
export const SCHEDULE_DATES = 30;

/**
 * Inside a series section every card is the same event, so the date is what
 * distinguishes one card from the next and takes the title slot.
 */
function toDateCard(row: Row): EventCard {
  return {
    seriesId: row.seriesId,
    instanceId: row.id,
    title: formatDateLabel(row.startsAt, row.series.timezone),
    meta: `${formatTimeRange(row.startsAt, row.endsAt, row.series.timezone)} ${timezoneLabel(
      row.startsAt,
      row.series.timezone,
    )}`,
    // The occurrence's own photo, so the card and the page it opens match.
    image: row.coverImage ?? coverImageFor(row.id),
    href: `/events/${row.seriesId}/${row.id}`,
    cancelled: row.status === "cancelled" || row.series.status === "cancelled",
  };
}

/**
 * Every public series with its upcoming dates. Series still being planned come
 * last and carry no dates — there are none to carry yet.
 */
export async function seriesSchedules(take = SCHEDULE_DATES): Promise<SeriesSection[]> {
  const now = new Date();

  const series = await prisma.eventSeries.findMany({
    where: { visibility: "public", status: "active" },
    include: {
      instances: {
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return series.map((row) => ({
    seriesId: row.id,
    title: row.title,
    // "Sunday Weekly Coworking Sessions" already reads as "every week on
    // Sunday", so the rule is never spelled out a second time.
    summary: null,
    href: `/events/${row.id}`,
    planned: false,
    events: row.instances.map((instance) => toDateCard({ ...instance, series: row })),
  }));
}

/**
 * The archive starts here. Dates before this ran while the house was still
 * being set up and are not kept: the archive is the record from this point on,
 * so until the first date after it has passed there is simply nothing to show.
 */
export const ARCHIVE_FROM = new Date("2026-08-30T00:00:00.000Z");

/** Dates that have already happened, newest first, grouped by series. */
export async function archivedSeries(take = 24): Promise<SeriesSection[]> {
  const now = new Date();

  const series = await prisma.eventSeries.findMany({
    where: { visibility: "public" },
    include: {
      instances: {
        where: { startsAt: { lt: now, gte: ARCHIVE_FROM } },
        orderBy: { startsAt: "desc" },
        take,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return series
    .filter((row) => row.instances.length > 0)
    .map((row) => ({
      seriesId: row.id,
      title: row.title,
      summary: null,
      href: `/events/${row.id}`,
      planned: false,
      events: row.instances.map((instance) => toDateCard({ ...instance, series: row })),
    }));
}

/**
 * The series being planned, for the announcement at the top of the page. They
 * have no dates to list, so naming them is the only way anyone learns they are
 * coming.
 */
export async function plannedSeries(): Promise<Array<{ id: string; title: string }>> {
  const rows = await prisma.eventSeries.findMany({
    where: { status: "draft", visibility: "public" },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });

  return rows.map((row) => ({ id: row.id, title: row.title }));
}
