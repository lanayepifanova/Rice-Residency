/* eslint-disable @next/next/no-img-element */

import type { EventCard } from "@/lib/server/feed";

/**
 * The event grid, plus the empty state that goes with it. Empty is a real state
 * in this product — a new account has nothing hosted and nothing attended — so
 * every list says what belongs there rather than rendering nothing.
 */
export function EventGrid({ events, empty }: { events: EventCard[]; empty: React.ReactNode }) {
  if (events.length === 0) {
    return <p className="event-empty">{empty}</p>;
  }

  return (
    <div className="event-grid">
      {events.map((event) => (
        <a className="event-square" href={event.href} key={event.instanceId}>
          <img src={event.image} alt="" />
          <span className="event-square-text">
            <h3>{event.title}</h3>
            <p>
              {event.cancelled ? "Cancelled · " : ""}
              {event.meta}
            </p>
          </span>
        </a>
      ))}
    </div>
  );
}

export function EventSection({
  title,
  events,
  empty,
}: {
  title: string;
  events: EventCard[];
  empty: React.ReactNode;
}) {
  return (
    <section className="event-section">
      <h2>{title}</h2>
      <EventGrid events={events} empty={empty} />
    </section>
  );
}
