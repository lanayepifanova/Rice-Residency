"use client";

import type { CapacitySnapshot } from "@/lib/domain/rsvp";
import { useReaderNow } from "./use-reader-now";

/**
 * How full an occurrence is.
 *
 * What is left of the RSVP panel now that the site has no accounts: the numbers
 * are still worth showing — whether a dinner has spots left is the first thing
 * anyone reads a date for — but there is nobody to attribute an answer to, so
 * there is nothing to press.
 *
 * It became a client component when the site stopped being rendered per
 * request. The one thing it says that is not a fact about the row — whether the
 * date has already happened — is a fact about the clock, and the build does not
 * have the reader's. So it takes the date and works that out on arrival rather
 * than being handed a `past` that was true whenever the site was last built.
 */
export function AttendanceLine({
  capacity,
  cancelled,
  startsAt,
  builtAt,
}: {
  capacity: CapacitySnapshot;
  cancelled: boolean;
  /** When the occurrence starts, as an ISO string. */
  startsAt: string;
  builtAt: number;
}) {
  const now = useReaderNow(builtAt);
  const past = Date.parse(startsAt) < now;

  if (cancelled) {
    return (
      <section className="rsvp-panel">
        <p className="rsvp-status" role="status">
          This occurrence has been cancelled.
        </p>
      </section>
    );
  }

  if (past) {
    return (
      <section className="rsvp-panel">
        <p className="rsvp-status" role="status">
          This occurrence has already happened.
        </p>
      </section>
    );
  }

  return (
    <section className="rsvp-panel">
      <CapacityLine capacity={capacity} />
    </section>
  );
}

function CapacityLine({ capacity }: { capacity: CapacitySnapshot }) {
  if (capacity.capacity === null) {
    return <p className="capacity-line">{capacity.seatsUsed} going. No limit on spots.</p>;
  }

  if (capacity.isFull) {
    return (
      <p className="capacity-line capacity-full">
        Full — {capacity.seatsUsed} of {capacity.capacity} spots taken.
      </p>
    );
  }

  return (
    <p className="capacity-line">
      {capacity.seatsRemaining} of {capacity.capacity} spots left.
      {capacity.waitlistCount > 0 ? ` ${capacity.waitlistCount} waiting.` : ""}
    </p>
  );
}
