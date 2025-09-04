/**
 * The shapes the event lists are made of, and the one rule that decides which
 * of them a page shows.
 *
 * This module holds no database import on purpose. The site is prerendered —
 * every page is built once, on the laptop that owns the data — which means the
 * one thing the build cannot know is what time it will be when somebody reads
 * the result. "Upcoming" and "already happened" are therefore not baked in;
 * they are decided from the reader's own clock, and this is the code that both
 * the build and the browser run to decide it. Keeping it free of server
 * imports is what lets the browser run it at all.
 */

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
  /**
   * When this occurrence starts, as an ISO string.
   *
   * Carried on the card rather than left in the database because the browser
   * has to be able to re-sort a prerendered list against the current time, and
   * it cannot ask Postgres. A string rather than a Date so it survives the trip
   * from a server component into a client one unchanged.
   */
  startsAt: string;
};

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

/** Which side of now a list wants. */
export type Horizon = "upcoming" | "past";

export type SelectOptions = {
  horizon: Horizon;
  /** How many to keep. Omitted means all of them. */
  take?: number;
  /**
   * Keep only the first card of each series. Used by the profile lists, where
   * a weekly event would otherwise fill the grid with itself; not used by the
   * home page, whose sections are already one series each.
   */
  onePerSeries?: boolean;
};

/**
 * The cards that belong on a page at a given moment.
 *
 * Order is taken as given rather than imposed: callers hand these in the order
 * they want them read — soonest-first for what is ahead, newest-first for what
 * has passed — and this only removes.
 */
export function selectByTime(
  events: EventCard[],
  options: SelectOptions,
  now: number,
): EventCard[] {
  const wanted = events.filter((event) => {
    const startsAt = Date.parse(event.startsAt);

    // A card whose date will not parse is kept rather than silently dropped:
    // losing an event from the house calendar is worse than showing it in the
    // wrong list, and one is visible while the other is not.
    if (Number.isNaN(startsAt)) {
      return true;
    }

    return options.horizon === "upcoming" ? startsAt >= now : startsAt < now;
  });

  const deduped = options.onePerSeries ? firstPerSeries(wanted) : wanted;

  return options.take === undefined ? deduped : deduped.slice(0, options.take);
}

function firstPerSeries(events: EventCard[]): EventCard[] {
  const seen = new Set<string>();

  return events.filter((event) => {
    if (seen.has(event.seriesId)) {
      return false;
    }
    seen.add(event.seriesId);
    return true;
  });
}

/**
 * The occurrence a bare series link should open: its next date, or the most
 * recent one if they have all happened.
 *
 * The same question `nextOccurrenceHref` used to answer against the database on
 * every request. It is asked in the browser now, for the same reason the split
 * above moved there — the answer changes with the clock, not with the data.
 */
export function nextOccurrence(events: EventCard[], now: number): EventCard | null {
  const byDate = [...events].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const upcoming = byDate.find(
    (event) => !event.cancelled && Date.parse(event.startsAt) >= now,
  );

  return upcoming ?? byDate[byDate.length - 1] ?? null;
}
