type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function zonedTimeToUtc(value: string, timezone: string): Date {
  const parts = parseLocalDateTime(value);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const firstOffset = getTimeZoneOffset(new Date(utcGuess), timezone);
  const firstUtc = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffset(new Date(firstUtc), timezone);
  return new Date(utcGuess - secondOffset);
}

export function localDateTimeToFloatingDate(value: string): Date {
  const parts = parseLocalDateTime(value);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}

export function floatingDateToLocalDateTime(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export function formatDateInTimeZone(date: Date, timezone: string): string {
  const parts = getZonedParts(date, timezone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function parseLocalDateTime(value: string): LocalParts {
  const match = localDateTimePattern.exec(value);
  if (!match) {
    throw new Error(`Invalid local date-time: ${value}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
}

function getTimeZoneOffset(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function getZonedParts(date: Date, timezone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
