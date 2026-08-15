"use client";

import { useActionState } from "react";
import { submitRsvpAction, type RsvpState } from "../events/actions";
import type { CapacitySnapshot } from "@/lib/domain/rsvp";

const initialState: RsvpState = { status: "idle" };

export type RsvpControlsProps = {
  seriesId: string;
  instanceId: string;
  capacity: CapacitySnapshot;
  current: { status: string; guestCount: number; waitlistRank: number | null } | null;
  signedIn: boolean;
  cancelled: boolean;
  past: boolean;
  waitlistEnabled: boolean;
};

export function RsvpControls(props: RsvpControlsProps) {
  const [state, action, pending] = useActionState(submitRsvpAction, initialState);

  if (props.cancelled) {
    return (
      <section className="rsvp-panel">
        <p className="rsvp-status" role="status">
          This occurrence has been cancelled, so RSVPs are closed.
        </p>
      </section>
    );
  }

  if (props.past) {
    return (
      <section className="rsvp-panel">
        <p className="rsvp-status" role="status">
          This occurrence has already happened.
        </p>
        {props.current ? <p className="field-hint">You answered {props.current.status}.</p> : null}
      </section>
    );
  }

  if (!props.signedIn) {
    return (
      <section className="rsvp-panel">
        <CapacityLine capacity={props.capacity} waitlistEnabled={props.waitlistEnabled} />
        <a className="rsvp-signin" href={`/login?next=/events/${props.seriesId}/${props.instanceId}`}>
          Sign in to RSVP
        </a>
      </section>
    );
  }

  return (
    <section className="rsvp-panel">
      {/* Capacity and waitlist state sit directly above the controls, so the
          answer to "will I actually get in" is visible at the moment of
          choosing rather than after submitting. */}
      <CapacityLine capacity={props.capacity} waitlistEnabled={props.waitlistEnabled} />

      {props.current ? <CurrentAnswer current={props.current} /> : null}

      <form action={action} className="rsvp-form">
        <input type="hidden" name="seriesId" value={props.seriesId} />
        <input type="hidden" name="instanceId" value={props.instanceId} />

        <label className="rsvp-guests">
          Guests
          <input
            name="guestCount"
            type="number"
            min="0"
            defaultValue={props.current?.guestCount ?? 0}
          />
        </label>

        <div className="rsvp-buttons">
          <button type="submit" name="status" value="going" disabled={pending}>
            {pending ? "Saving…" : "Going"}
          </button>
          <button type="submit" name="status" value="maybe" disabled={pending}>
            Maybe
          </button>
          <button type="submit" name="status" value="busy" disabled={pending}>
            Busy
          </button>
        </div>
      </form>

      {state.status === "saved" ? (
        <p className="rsvp-status" role="status">
          {state.message}
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="rsvp-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <p className="field-hint">
        Only “going” takes a spot, and each guest takes one too. Maybe and busy never count against
        capacity.
      </p>
    </section>
  );
}

function CurrentAnswer({
  current,
}: {
  current: { status: string; guestCount: number; waitlistRank: number | null };
}) {
  if (current.status === "waitlisted") {
    return (
      <p className="rsvp-current">
        You are number {current.waitlistRank ?? 1} on the waitlist
        {current.guestCount > 0 ? ` with ${current.guestCount} guests` : ""}. You move up
        automatically when a spot opens.
      </p>
    );
  }

  return (
    <p className="rsvp-current">
      Your answer: <strong>{current.status}</strong>
      {current.status === "going" && current.guestCount > 0
        ? ` plus ${current.guestCount} ${current.guestCount === 1 ? "guest" : "guests"}`
        : ""}
      .
    </p>
  );
}

function CapacityLine({
  capacity,
  waitlistEnabled,
}: {
  capacity: CapacitySnapshot;
  waitlistEnabled: boolean;
}) {
  if (capacity.capacity === null) {
    return (
      <p className="capacity-line">
        {capacity.seatsUsed} going. No limit on spots.
      </p>
    );
  }

  if (capacity.isFull) {
    return (
      <p className="capacity-line capacity-full">
        Full — {capacity.seatsUsed} of {capacity.capacity} spots taken.
        {waitlistEnabled
          ? ` Answering “going” adds you to the waitlist${capacity.waitlistCount > 0 ? `, currently ${capacity.waitlistCount} long` : ""}.`
          : " The waitlist is turned off for this event."}
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
