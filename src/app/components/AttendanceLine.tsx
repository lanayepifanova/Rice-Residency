import type { CapacitySnapshot } from "@/lib/domain/rsvp";

/**
 * How full an occurrence is.
 *
 * What is left of the RSVP panel now that the site has no accounts: the numbers
 * are still worth showing — whether a dinner has spots left is the first thing
 * anyone reads a date for — but there is nobody to attribute an answer to, so
 * there is nothing to press. A plain server component, because without a form
 * there is no state to hold.
 */
export function AttendanceLine({
  capacity,
  cancelled,
  past,
}: {
  capacity: CapacitySnapshot;
  cancelled: boolean;
  past: boolean;
}) {
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
