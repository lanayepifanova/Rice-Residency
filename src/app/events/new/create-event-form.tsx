"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState } from "react";
import { submitEventForm, type CreateEventState } from "../actions";
import { formatShort } from "@/lib/domain/format";

const weekdays = [
  ["MO", "Monday"],
  ["TU", "Tuesday"],
  ["WE", "Wednesday"],
  ["TH", "Thursday"],
  ["FR", "Friday"],
  ["SA", "Saturday"],
  ["SU", "Sunday"],
] as const;

const initialState: CreateEventState = { status: "idle" };

export function CreateEventForm({
  coverImage,
  defaultTimezone,
}: {
  coverImage: string;
  defaultTimezone: string;
}) {
  const [state, action, pending] = useActionState(submitEventForm, initialState);
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <form action={action} noValidate>
      <div className="create-event-layout">
        <div className="create-event-fields">
          {state.status === "invalid" ? (
            <p className="form-error" role="alert">
              {state.message}
            </p>
          ) : null}

          <fieldset>
            <legend>Event</legend>

            <Field label="Title" error={errors.title}>
              <input name="title" defaultValue="" placeholder="Weekly Run Club" required />
            </Field>

            <Field label="Location" error={errors.locationName}>
              <input name="locationName" placeholder="Riverside Park" />
            </Field>

            <Field label="Invites" error={errors["inviteEmails.0"] ?? errors.inviteEmails}>
              <textarea
                name="inviteEmails"
                placeholder="maya@example.com, jordan@example.com"
              />
              <span className="field-hint">
                Separate addresses with commas. People without an account get the invite when they
                first sign in.
              </span>
            </Field>

            <Field label="Capacity" error={errors.capacity}>
              <input name="capacity" type="number" min="1" placeholder="Leave empty for no limit" />
            </Field>

            <Field label="Description" error={errors.description}>
              <textarea name="description" placeholder="Meet by the park entrance." />
            </Field>
          </fieldset>

          <fieldset>
            <legend>Schedule</legend>

            <Field label="Timezone" error={errors.timezone}>
              <input name="timezone" defaultValue={defaultTimezone} required />
              <span className="field-hint">
                Times are shown in this timezone to everyone, and stay put across daylight saving
                changes.
              </span>
            </Field>

            <Field label="Starts" error={errors.startsAtLocal}>
              <input name="startsAtLocal" type="datetime-local" required />
            </Field>

            <Field label="Duration minutes" error={errors.durationMinutes}>
              <input name="durationMinutes" type="number" min="1" defaultValue="60" required />
            </Field>
          </fieldset>

          <fieldset>
            <legend>Recurrence</legend>

            <Field label="Frequency" error={errors.freq}>
              <select name="freq" defaultValue="weekly">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>

            <Field label="Repeat every" error={errors.interval}>
              <input name="interval" type="number" min="1" defaultValue="1" required />
              <span className="field-hint">
                2 with a weekly frequency means every other week.
              </span>
            </Field>

            <div className="field">
              <p className="field-label">Weekdays</p>
              {weekdays.map(([value, label]) => (
                <label key={value} className="inline-label">
                  <input name="byDay" type="checkbox" value={value} />
                  {label}
                </label>
              ))}
            </div>

            <Field label="Ends on" error={errors.until}>
              <input name="until" type="datetime-local" />
              <span className="field-hint">
                Leave empty to repeat indefinitely. Occurrences are generated up to ten years ahead.
              </span>
            </Field>
          </fieldset>

          <fieldset>
            <legend>Attendance</legend>

            <label className="inline-label">
              <input name="waitlistEnabled" type="checkbox" defaultChecked />
              Keep a waitlist when the event is full
            </label>
            <span className="field-hint">
              With this off, people are turned away once capacity is reached.
            </span>
          </fieldset>
        </div>

        <aside className="create-event-photo-panel">
          <img className="create-event-photo" src={coverImage} alt="" />
          <input name="coverImage" type="hidden" value={coverImage} />

          {state.status === "preview" ? (
            <section className="preview-panel" aria-live="polite">
              <h2>{state.summary}</h2>
              <p className="field-hint">First {state.occurrences.length} occurrences</p>
              <ol className="preview-list">
                {state.occurrences.map((occurrence) => (
                  <li key={occurrence.startsAt}>
                    {formatShort(new Date(occurrence.startsAt), state.timezone)}
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <p className="field-hint preview-empty">
              Preview the dates before publishing to check the rule does what you expect.
            </p>
          )}
        </aside>
      </div>

      <input name="visibility" type="hidden" value="public" />

      <div className="form-actions">
        <button type="submit" name="intent" value="preview" disabled={pending}>
          {pending ? "Working…" : "Preview dates"}
        </button>
        <button type="submit" name="intent" value="publish" disabled={pending}>
          {pending ? "Publishing…" : "Publish event"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={error ? "field field-invalid" : "field"}>
      <span className="field-label">{label}</span>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
