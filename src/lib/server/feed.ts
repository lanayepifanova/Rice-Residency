import type { EventInstance, EventSeries } from "@prisma/client";
import { prisma } from "@/lib/db";
import { coverImageFor } from "@/lib/domain/event-images";
import type { EventCard, SeriesSection } from "@/lib/domain/events";
import { formatDateLabel, formatShort, formatTimeRange, timezoneLabel } from "@/lib/domain/format";

export type { EventCard, SeriesSection } from "@/lib/domain/events";

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
    startsAt: row.startsAt.toISOString(),
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

/**
 * Everything this user hosts, soonest first.
 *
 * The occurrences are not narrowed to the ones still ahead and not cut down to
 * one per series here, the way they were when this ran per request. Both of
 * those depend on the current time, and the current time is the one thing a
 * prerender does not have: the page is built once and read for weeks. The whole
 * run is handed over and `selectByTime` makes the cut in the browser.
 */
export async function hostedEvents(userId: string): Promise<EventCard[]> {
  const rows = await prisma.eventInstance.findMany({
    where: { series: { organizerId: userId } },
    include: { series: true },
    orderBy: { startsAt: "asc" },
  });

  return rows.map(toCard);
}

/**
 * Occurrences this user said they were going to, newest first.
 *
 * "Has it happened yet" is left to the browser, so a date they answered for
 * moves from nothing to the attended list on the day it passes rather than on
 * the day the site is next built.
 */
export async function attendedEvents(userId: string): Promise<EventCard[]> {
  const rsvps = await prisma.eventRsvp.findMany({
    where: { userId, status: "going" },
    include: { instance: { include: { series: true } } },
    orderBy: { instance: { startsAt: "desc" } },
  });

  return rsvps.map((rsvp) => toCard(rsvp.instance));
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
    startsAt: row.startsAt.toISOString(),
  };
}

/**
 * Every public series with its upcoming dates. Series still being planned come
 * last and carry no dates — there are none to carry yet.
 */
export async function seriesSchedules(): Promise<SeriesSection[]> {
  const series = await prisma.eventSeries.findMany({
    where: { visibility: "public", status: "active" },
    include: {
      instances: {
        orderBy: { startsAt: "asc" },
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
export async function archivedSeries(): Promise<SeriesSection[]> {
  const series = await prisma.eventSeries.findMany({
    where: { visibility: "public" },
    include: {
      instances: {
        // ARCHIVE_FROM is a fixed date, so it still belongs in the query; the
        // "already happened" half of the old range was the moving part and it
        // has gone to the browser.
        where: { startsAt: { gte: ARCHIVE_FROM } },
        orderBy: { startsAt: "desc" },
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

/**
 * Every public series id, so a page can be built for each.
 *
 * Draft series are included. They are the ones with no dates yet, and their
 * "coming soon" page is exactly what the Parties and Dinners entries in the nav
 * point at before a date is on the books.
 */
export async function publicSeriesIds(): Promise<string[]> {
  const rows = await prisma.eventSeries.findMany({
    where: { visibility: "public" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return rows.map((row) => row.id);
}

/**
 * The dates under one series, soonest first, or null if there is no such
 * public series.
 *
 * The empty array and null are different answers and the caller treats them
 * differently: nothing scheduled yet is "coming soon", and no such event is a
 * 404.
 */
export async function seriesDates(seriesId: string): Promise<EventCard[] | null> {
  const series = await prisma.eventSeries.findUnique({
    where: { id: seriesId },
    include: { instances: { orderBy: { startsAt: "asc" } } },
  });

  if (!series || series.visibility !== "public") {
    return null;
  }

  return series.instances.map((instance) => toDateCard({ ...instance, series }));
}

/**
 * Every public occurrence, as the `{ seriesId, instanceId }` pairs the date
 * pages are built from.
 *
 * Cancelled dates are included on purpose. A cancelled event is exactly the one
 * somebody with the link in a message needs to be able to open — the page says
 * it is off, which a 404 would not.
 */
export async function publicOccurrenceParams(): Promise<
  Array<{ seriesId: string; instanceId: string }>
> {
  const rows = await prisma.eventInstance.findMany({
    where: { series: { visibility: "public" } },
    orderBy: { startsAt: "asc" },
    select: { id: true, seriesId: true },
  });

  return rows.map((row) => ({ seriesId: row.seriesId, instanceId: row.id }));
}

export type ShareTarget = {
  token: string;
  /** Where to send the visitor, or null when the dates decide it. */
  destination: string | null;
  /** The series' dates, for a series-wide link whose target moves with time. */
  dates: EventCard[];
};

/**
 * Every share link, resolved as far as it can be resolved ahead of time.
 *
 * A link to one date resolves completely — that page is where it goes, today
 * and next year. A link to a whole series does not: it means "the next one",
 * and which date that is changes without the data changing, so its dates are
 * carried across and the browser picks between them.
 *
 * Revoked links are built too. A token that was shared and then withdrawn is
 * one somebody still has in a message, and telling them it was revoked is a
 * better answer than a page that does not exist.
 *
 * Opening a link no longer records the visit. The counter it used to keep was
 * the last write the public site performed, and it was being written to a
 * database the built site cannot reach — a per-visit count was never going to
 * survive the site becoming files.
 */
export async function listShareTargets(): Promise<ShareTarget[]> {
  const links = await prisma.eventShareLink.findMany({
    include: { series: { include: { instances: { orderBy: { startsAt: "asc" } } } } },
    orderBy: { createdAt: "asc" },
  });

  return links.map((link) => {
    const expired = "/explore?share=expired";

    if (link.revokedAt || !link.series || link.series.visibility !== "public") {
      return { token: link.token, destination: expired, dates: [] };
    }

    if (link.instanceId) {
      return {
        token: link.token,
        destination: `/events/${link.seriesId}/${link.instanceId}`,
        dates: [],
      };
    }

    const dates = link.series.instances.map((instance) =>
      toDateCard({ ...instance, series: link.series! }),
    );

    // A series link with no dates under it has nowhere to go but the calendar.
    return {
      token: link.token,
      destination: dates.length ? null : "/",
      dates,
    };
  });
}
