/**
 * Every date shown in the app is formatted in the event's own timezone, not the
 * reader's. An event that starts at 18:30 in New York reads as 18:30 to
 * everyone, because that is the time people are being asked to show up.
 */

function formatter(timezone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, ...options });
}

/**
 * Times read as "5:00 PM". Formatted in en-US rather than the en-GB used for
 * dates, because en-GB renders the meridiem lowercase.
 */
function timeFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Monday 7 September 2026, 6:30 PM" */
export function formatOccurrence(date: Date, timezone: string): string {
  return `${formatDay(date, timezone)}, ${timeFormatter(timezone).format(date)}`;
}

/** "Mon 7 Sep, 6:30 PM" — for cards and lists. */
export function formatShort(date: Date, timezone: string): string {
  return `${formatDateLabel(date, timezone)}, ${timeFormatter(timezone).format(date)}`;
}

/** "6:30 PM – 7:30 PM" */
export function formatTimeRange(start: Date, end: Date, timezone: string): string {
  const time = timeFormatter(timezone);
  return `${time.format(start)} – ${time.format(end)}`;
}

/** "Monday 7 September 2026" */
export function formatDay(date: Date, timezone: string): string {
  return formatter(timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "Sunday 30 Aug" — the date on its own, for a card inside a dated list. */
export function formatDateLabel(date: Date, timezone: string): string {
  const badge = formatDateBadge(date, timezone);
  // The weekday is written out: on a card it is the part that says whether the
  // date is one you can make, so it is not the place to abbreviate.
  const weekday = formatter(timezone, { weekday: "long" }).format(date);
  // Title case rather than the badge's caps: this one sits in a heading.
  const month = badge.month.charAt(0) + badge.month.slice(1).toLowerCase();
  return `${weekday} ${badge.day} ${month}`;
}

/**
 * The parts of a date shown in a list badge: "AUG" / "16" / "Sun". Split rather
 * than pre-joined so the badge can size and stack each part on its own.
 */
export function formatDateBadge(
  date: Date,
  timezone: string,
): { month: string; day: string; weekday: string } {
  const parts = formatter(timezone, {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return {
    // en-GB abbreviates September as "Sept"; the badge wants a uniform width.
    month: part("month").toUpperCase().slice(0, 3),
    day: part("day"),
    weekday: part("weekday"),
  };
}

/**
 * The short timezone label shown beside a time, e.g. "CDT". Formatted in en-US
 * rather than the en-GB used everywhere else, because en-GB renders US zones as
 * "GMT-5" and the name of the zone is the whole point of the label.
 */
export function timezoneLabel(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
}

/** "in 3 days", "today", "2 weeks ago" — relative to now, day-granular. */
export function relativeDay(date: Date, timezone: string, now = new Date()): string {
  const days = Math.round(
    (startOfDayUtc(date, timezone) - startOfDayUtc(now, timezone)) / 86_400_000,
  );

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";

  const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

  if (Math.abs(days) < 14) return relative.format(days, "day");
  if (Math.abs(days) < 60) return relative.format(Math.round(days / 7), "week");
  if (Math.abs(days) < 365) return relative.format(Math.round(days / 30), "month");
  return relative.format(Math.round(days / 365), "year");
}

function startOfDayUtc(date: Date, timezone: string): number {
  const parts = Object.fromEntries(
    formatter(timezone, { year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}
