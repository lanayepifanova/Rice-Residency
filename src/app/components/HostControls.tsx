"use client";

import { useActionState } from "react";
import {
  cancelAction,
  editAction,
  type EditState,
  type HostActionState,
} from "../events/actions";

const editInitial: EditState = { status: "idle" };
const cancelInitial: HostActionState = { status: "idle" };

export type HostControlsProps = {
  seriesId: string;
  /** The occurrence in view, if any. Scoped actions need it as their anchor. */
  instanceId: string | null;
  instanceLabel: string | null;
  title: string;
  description: string;
  locationName: string;
  capacity: number | null;
  waitlistEnabled: boolean;
  seriesCancelled: boolean;
  instanceCancelled: boolean;
};

export function HostControls(props: HostControlsProps) {
  return (
    <section className="host-controls">
      <h2>Host tools</h2>

      {props.seriesCancelled ? (
        <p className="rsvp-status">This event is cancelled. Editing is closed.</p>
      ) : (
        <>
          <EditPanel {...props} />
          <CancelPanel {...props} />
        </>
      )}
    </section>
  );
}

function EditPanel(props: HostControlsProps) {
  const [state, action, pending] = useActionState(editAction, editInitial);

  return (
    <details className="host-panel">
      <summary>Edit details</summary>

      <form action={action}>
        <input type="hidden" name="seriesId" value={props.seriesId} />
        <input type="hidden" name="instanceId" value={props.instanceId ?? ""} />

        <label className="field">
          <span className="field-label">Title</span>
          <input name="title" defaultValue={props.title} required />
        </label>

        <label className="field">
          <span className="field-label">Description</span>
          <textarea name="description" defaultValue={props.description} />
        </label>

        <label className="field">
          <span className="field-label">Location</span>
          <input name="locationName" defaultValue={props.locationName} />
        </label>

        <label className="field">
          <span className="field-label">Capacity</span>
          <input
            name="capacity"
            type="number"
            min="1"
            defaultValue={props.capacity ?? ""}
            placeholder="No limit"
          />
          <span className="field-hint">
            Capacity and the waitlist belong to the whole event, so they only apply to the two
            series-wide buttons.
          </span>
        </label>

        <label className="inline-label">
          <input name="waitlistEnabled" type="checkbox" defaultChecked={props.waitlistEnabled} />
          Keep a waitlist when full
        </label>

        {/* Three buttons rather than a dropdown: the scope is the decision, and
            each one says plainly what it will change. */}
        <div className="scope-buttons">
          {props.instanceId ? (
            <button type="submit" name="scope" value="this" disabled={pending}>
              Save this occurrence only
            </button>
          ) : null}
          {props.instanceId ? (
            <button type="submit" name="scope" value="future" disabled={pending}>
              Save this and all future occurrences
            </button>
          ) : null}
          <button type="submit" name="scope" value="all" disabled={pending}>
            Save the entire series
          </button>
        </div>

        {props.instanceId ? (
          <p className="field-hint">
            {props.instanceLabel
              ? `“This occurrence” means ${props.instanceLabel} alone. “This and all future” splits the event, leaving occurrences before it exactly as they were.`
              : null}
          </p>
        ) : null}

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
      </form>
    </details>
  );
}

function CancelPanel(props: HostControlsProps) {
  const [state, action, pending] = useActionState(cancelAction, cancelInitial);

  return (
    <details className="host-panel host-panel-danger">
      <summary>Cancel occurrences</summary>

      {/* Opening this panel is the first step; each button then states exactly
          what it cancels. Nothing here is a single unlabelled click. */}
      <p className="danger-copy">
        Cancelling notifies everyone who answered. It cannot be undone from here.
      </p>

      <form action={action}>
        <input type="hidden" name="seriesId" value={props.seriesId} />
        <input type="hidden" name="instanceId" value={props.instanceId ?? ""} />

        <div className="scope-buttons">
          {props.instanceId && !props.instanceCancelled ? (
            <button type="submit" name="scope" value="this" disabled={pending}>
              Cancel {props.instanceLabel ?? "this occurrence"} only
            </button>
          ) : null}
          {props.instanceId ? (
            <button type="submit" name="scope" value="future" disabled={pending}>
              Cancel this and all future occurrences
            </button>
          ) : null}
          <button type="submit" name="scope" value="all" disabled={pending}>
            Cancel the entire series, including past occurrences
          </button>
        </div>

        {state.status === "error" ? (
          <p className="rsvp-error" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
