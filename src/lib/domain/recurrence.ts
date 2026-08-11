import { RRule, type Options, Weekday } from "rrule";
import { floatingDateToLocalDateTime, localDateTimeToFloatingDate, zonedTimeToUtc } from "./timezone";

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
  limit?: number;
  horizonYears?: number;
};

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

export function buildRecurrenceSummary(rule: RecurrenceRuleInput): string {
  const interval = rule.interval === 1 ? "" : `${rule.interval} `;
  const unit = {
    daily: "day",
    weekly: "week",
    monthly: "month",
    yearly: "year",
  }[rule.freq];
  const plural = rule.interval === 1 ? unit : `${unit}s`;
  const days = rule.byDay?.length ? ` on ${rule.byDay.join(", ")}` : "";
  return `Every ${interval}${plural}${days}`;
}

export function buildInstances(input: BuildInstancesInput): EventInstancePreview[] {
  if (input.durationMinutes <= 0) {
    throw new Error("Duration must be greater than zero.");
  }

  if (input.recurrence.interval < 1) {
    throw new Error("Recurrence interval must be at least 1.");
  }

  const startsAt = localDateTimeToFloatingDate(input.startsAtLocal);
  const horizonYears = input.horizonYears ?? 10;
  const limit = input.limit ?? 20;
  const horizonUntil = addYears(startsAt, horizonYears);
  const requestedUntil = input.recurrence.until ? localDateTimeToFloatingDate(input.recurrence.until) : horizonUntil;
  const until = requestedUntil < horizonUntil ? requestedUntil : horizonUntil;

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

  return rule.all((_date, index) => index < limit).map((floatingStart) => {
    const localStart = floatingDateToLocalDateTime(floatingStart);
    const start = zonedTimeToUtc(localStart, input.timezone);
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);
    return {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      localDate: localStart.slice(0, 10),
    };
  });
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}
