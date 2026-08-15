import { RRule, type Options, Weekday } from "rrule";
import {
  floatingDateToLocalDateTime,
  localDateTimeToFloatingDate,
  utcToFloatingDate,
  zonedTimeToUtc,
} from "./timezone";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurrenceRuleInput = {
  freq: RecurrenceFrequency;
  interval: number;
  byDay?: string[];
  byMonthDay?: number[];
  bySetPosition?: number[];
  until?: string | null;
  count?: number | null;
};

export type EventInstancePreview = {
  startsAt: string;
  endsAt: string;
  localDate: string;
};

export type BuildInstancesInput = {
  startsAtLocal: string;
  durationMinutes: number;
  timezone: string;
  recurrence: RecurrenceRuleInput;
  /** Maximum number of occurrences to return. */
  limit?: number;
  /** Hard cap from the product plan: never generate beyond this many years. */
  horizonYears?: number;
  /** Only generate occurrences starting at or before this instant. */
  through?: Date;
  /** Only return occurrences starting at or after this instant. */
  from?: Date;
};

/**
 * Occurrences are generated in batches rather than all at once, so a
 * never-ending series does not have to hold ten years of rows to be usable.
 */
export const DEFAULT_MATERIALIZE_LIMIT = 60;

/** How far ahead the rolling window keeps occurrences materialized. */
export const MATERIALIZE_HORIZON_DAYS = 365;

export const MAX_HORIZON_YEARS = 10;

const frequencyMap: Record<RecurrenceFrequency, Options["freq"]> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly: RRule.YEARLY,
};

const weekdays: Record<string, Weekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

const weekdayNames: Record<string, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};

const positionNames: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  5: "fifth",
  [-1]: "last",
  [-2]: "second to last",
};

/**
 * Plain-language recurrence, e.g. "Every 2 weeks on Monday and Thursday,
 * until 7 March 2027". The product plan requires recurrence to be readable
 * without decoding RRULE jargon, so this is what every surface renders.
 */
export function buildRecurrenceSummary(rule: RecurrenceRuleInput): string {
  const unit = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[rule.freq];
  const cadence = rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;

  const parts = [cadence];

  const dayNames = rule.byDay?.map((day) => weekdayNames[day.toUpperCase()] ?? day) ?? [];

  if (dayNames.length) {
    if (rule.freq === "monthly" && rule.bySetPosition?.length) {
      const positions = rule.bySetPosition.map((value) => positionNames[value] ?? `${value}`);
      parts.push(`on the ${joinWords(positions)} ${joinWords(dayNames)}`);
    } else {
      parts.push(`on ${joinWords(dayNames)}`);
    }
  } else if (rule.byMonthDay?.length) {
    parts.push(`on the ${joinWords(rule.byMonthDay.map(ordinal))}`);
  }

  let summary = parts.join(" ");

  if (rule.count) {
    summary += `, ${rule.count} ${rule.count === 1 ? "time" : "times"}`;
  } else if (rule.until) {
    summary += `, until ${formatLocalDateLabel(rule.until)}`;
  }

  return summary;
}

export function buildInstances(input: BuildInstancesInput): EventInstancePreview[] {
  if (input.durationMinutes <= 0) {
    throw new Error("Duration must be greater than zero.");
  }

  if (input.recurrence.interval < 1) {
    throw new Error("Recurrence interval must be at least 1.");
  }

  const startsAt = localDateTimeToFloatingDate(input.startsAtLocal);
  const horizonYears = Math.min(input.horizonYears ?? MAX_HORIZON_YEARS, MAX_HORIZON_YEARS);
  const limit = input.limit ?? DEFAULT_MATERIALIZE_LIMIT;

  // Three separate ceilings, and the tightest always wins: the organizer's own
  // `until`, the product-level ten-year cap, and how far the rolling window has
  // been asked to reach. The ten-year cap is applied here rather than by the
  // caller so no code path can generate past it.
  const horizonUntil = addYears(startsAt, horizonYears);
  const requestedUntil = input.recurrence.until
    ? localDateTimeToFloatingDate(input.recurrence.until)
    : null;
  const windowUntil = input.through ? utcToFloatingDate(input.through, input.timezone) : null;

  const until = [requestedUntil, horizonUntil, windowUntil]
    .filter((value): value is Date => value !== null)
    .reduce((earliest, value) => (value < earliest ? value : earliest));

  if (until < startsAt) {
    return [];
  }

  const rule = new RRule({
    freq: frequencyMap[input.recurrence.freq],
    interval: input.recurrence.interval,
    dtstart: startsAt,
    until,
    count: input.recurrence.count ?? undefined,
    byweekday: input.recurrence.byDay?.map((day) => {
      const weekday = weekdays[day.toUpperCase()];
      if (!weekday) {
        throw new Error(`Unsupported weekday: ${day}`);
      }
      return weekday;
    }),
    bymonthday: input.recurrence.byMonthDay,
    bysetpos: input.recurrence.bySetPosition,
  });

  const occurrences: EventInstancePreview[] = [];
  const fromMs = input.from?.getTime() ?? Number.NEGATIVE_INFINITY;

  // Results are accumulated here rather than taken from `all`'s return value,
  // because occurrences before `from` still have to be walked past without
  // counting against the limit. Returning false ends the walk, so an unbounded
  // series never expands its full ten years to hand back the next few dates.
  rule.all((floatingStart) => {
    if (occurrences.length >= limit) {
      return false;
    }

    const localStart = floatingDateToLocalDateTime(floatingStart);
    const start = zonedTimeToUtc(localStart, input.timezone);

    if (start.getTime() >= fromMs) {
      const end = new Date(start.getTime() + input.durationMinutes * 60_000);
      occurrences.push({
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        localDate: localStart.slice(0, 10),
      });
    }

    return true;
  });

  return occurrences;
}

/** The instant the ten-year cap falls on, for storing alongside a series. */
export function recurrenceHardCeiling(startsAtLocal: string, timezone: string): Date {
  const ceiling = addYears(localDateTimeToFloatingDate(startsAtLocal), MAX_HORIZON_YEARS);
  return zonedTimeToUtc(floatingDateToLocalDateTime(ceiling), timezone);
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function joinWords(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function ordinal(value: number): string {
  const remainderTen = value % 10;
  const remainderHundred = value % 100;

  if (remainderTen === 1 && remainderHundred !== 11) return `${value}st`;
  if (remainderTen === 2 && remainderHundred !== 12) return `${value}nd`;
  if (remainderTen === 3 && remainderHundred !== 13) return `${value}rd`;
  return `${value}th`;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatLocalDateLabel(localDateTime: string): string {
  const [datePart] = localDateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}
