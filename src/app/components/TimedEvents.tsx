"use client";

import {
  selectByTime,
  type EventCard,
  type Horizon,
  type SeriesSection,
} from "@/lib/domain/events";
import { EventGrid, EventSection, SeriesEvents } from "./EventGrid";
import { useReaderNow } from "./use-reader-now";

/**
 * The event lists, split against the clock of whoever is reading.
 *
 * The practical effect is that the site ages correctly on its own: a date that
 * passes on Tuesday leaves the home page and joins the archive on Tuesday,
 * whether or not anyone has rebuilt since. See `useReaderNow` for why the build
 * has to render its own answer first.
 */

export function TimedSeriesEvents({
  section,
  horizon,
  take,
  builtAt,
  empty,
}: {
  section: SeriesSection;
  horizon: Horizon;
  take?: number;
  builtAt: number;
  empty: React.ReactNode;
}) {
  const now = useReaderNow(builtAt);
  const events = selectByTime(section.events, { horizon, take }, now);

  return <SeriesEvents section={{ ...section, events }} empty={empty} />;
}

export function TimedEventSection({
  title,
  events,
  horizon,
  take,
  onePerSeries,
  builtAt,
  empty,
}: {
  title: string;
  events: EventCard[];
  horizon: Horizon;
  take?: number;
  onePerSeries?: boolean;
  builtAt: number;
  empty: React.ReactNode;
}) {
  const now = useReaderNow(builtAt);

  return (
    <EventSection
      title={title}
      events={selectByTime(events, { horizon, take, onePerSeries }, now)}
      empty={empty}
    />
  );
}

/**
 * A whole page's worth of sections, where a section with nothing left in it
 * should disappear rather than sit there empty.
 *
 * The archive needs this and the home page does not: home lists the standing
 * series whether or not a date is on the books, because "no dates scheduled
 * ahead" is worth saying about an event the house runs. The archive is a
 * record, and a record of nothing is not a heading.
 */
export function TimedArchive({
  sections,
  take,
  builtAt,
  fallback,
}: {
  sections: SeriesSection[];
  take?: number;
  builtAt: number;
  fallback: React.ReactNode;
}) {
  const now = useReaderNow(builtAt);

  const populated = sections
    .map((section) => ({
      ...section,
      events: selectByTime(section.events, { horizon: "past", take }, now),
    }))
    .filter((section) => section.events.length > 0);

  if (populated.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <>
      <h1 className="welcome-heading">Archive</h1>
      {populated.map((section) => (
        <SeriesEvents key={section.seriesId} section={section} empty={null} />
      ))}
    </>
  );
}

export { EventGrid };
