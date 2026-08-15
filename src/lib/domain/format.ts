/**
 * Every date shown in the app is formatted in the event's own timezone, not the
 * reader's. An event that starts at 18:30 in New York reads as 18:30 to
 * everyone, because that is the time people are being asked to show up.
 */

function formatter(timezone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, ...options });
}

/** "Monday 7 September 2026, 18:30" */
export function formatOccurrence(date: Date, timezone: string): string {
  return formatter(timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "Mon 7 Sep, 18:30" — for cards and lists. */
export function formatShort(date: Date, timezone: string): string {
  return formatter(timezone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "18:30 – 19:30" */
export function formatTimeRange(start: Date, end: Date, timezone: string): string {
  const time = formatter(timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
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

/** The short timezone label shown beside a time, e.g. "EDT". */
export function timezoneLabel(date: Date, timezone: string): string {
  const parts = formatter(timezone, { timeZoneName: "short" }).formatToParts(date);
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
