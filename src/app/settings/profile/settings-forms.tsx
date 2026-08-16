"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState } from "react";
import {
  savePreferencesAction,
  saveProfileAction,
  type PreferencesState,
  type ProfileState,
} from "../actions";

const profileInitial: ProfileState = { status: "idle" };
const preferencesInitial: PreferencesState = { status: "idle" };

export type ProfileFormValues = {
  email: string;
  name: string;
  username: string;
  bio: string;
  riceYear: string;
  major: string;
  projectName: string;
  projectSummary: string;
  projectUrl: string;
  pastProjects: string;
  helpNeeded: string;
  instagram: string;
  twitter: string;
  birthday: string;
  avatarUrl: string | null;
  initial: string;
};

export function ProfileForm({ values }: { values: ProfileFormValues }) {
  const [state, action, pending] = useActionState(saveProfileAction, profileInitial);
  const errorField = state.status === "error" ? state.field : null;

  return (
    <form action={action} encType="multipart/form-data">
      <fieldset>
        <legend>Profile picture</legend>

        <label className="profile-photo-upload">
          {values.avatarUrl ? (
            <img className="profile-photo-large" src={values.avatarUrl} alt="" />
          ) : (
            <span className="profile-photo-large" aria-hidden="true">
              {values.initial}
            </span>
          )}
          <input name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
        </label>
        <span className="field-hint">PNG, JPEG, WebP, or GIF, up to 5MB.</span>

        {values.avatarUrl ? (
          <label className="inline-label">
            <input name="removePhoto" type="checkbox" />
            Remove my current photo
          </label>
        ) : null}

        {errorField === "photo" && state.status === "error" ? (
          <p className="field-error" role="alert">
            {state.message}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>Profile details</legend>

        <label className="field">
          <span className="field-label">Email</span>
          <input value={values.email} readOnly disabled />
          <span className="field-hint">Your email is how you sign in and cannot be changed here.</span>
        </label>

        <label className={errorField === "name" ? "field field-invalid" : "field"}>
          <span className="field-label">Name</span>
          <input name="name" defaultValue={values.name} required />
        </label>

        <label className={errorField === "username" ? "field field-invalid" : "field"}>
          <span className="field-label">Username</span>
          <input name="username" defaultValue={values.username} required />
          {errorField === "username" && state.status === "error" ? (
            <span className="field-error" role="alert">
              {state.message}
            </span>
          ) : null}
        </label>

        <label className="field">
          <span className="field-label">Quick description</span>
          <textarea name="bio" defaultValue={values.bio} placeholder="A short note about you." />
        </label>

        <label className="field">
          <span className="field-label">Year at Rice</span>
          <input name="riceYear" defaultValue={values.riceYear} placeholder="Junior, PhD 2, Alum" />
        </label>

        <label className="field">
          <span className="field-label">Major</span>
          <input name="major" defaultValue={values.major} placeholder="Computer Science" />
        </label>

        <label className="field">
          <span className="field-label">What you are working on</span>
          <input
            name="projectName"
            defaultValue={values.projectName}
            placeholder="Project name"
          />
          <span className="field-hint">
            Shown on the people page, so the house can find each other by what they are building.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Project, in one line</span>
          <input
            name="projectSummary"
            defaultValue={values.projectSummary}
            placeholder="What it does, briefly."
          />
        </label>

        <label className={errorField === "projectUrl" ? "field field-invalid" : "field"}>
          <span className="field-label">Project link</span>
          <input name="projectUrl" defaultValue={values.projectUrl} placeholder="https://" />
          {errorField === "projectUrl" && state.status === "error" ? (
            <span className="field-error" role="alert">
              {state.message}
            </span>
          ) : null}
        </label>

        <label className="field">
          <span className="field-label">Past projects</span>
          <textarea
            name="pastProjects"
            defaultValue={values.pastProjects}
            placeholder="Things you have already built or shipped."
          />
        </label>

        <label className="field">
          <span className="field-label">What you need help with</span>
          <textarea
            name="helpNeeded"
            defaultValue={values.helpNeeded}
            placeholder="The ask someone else in the house might be able to answer."
          />
        </label>

        <label className="field">
          <span className="field-label">Instagram</span>
          <input name="instagram" defaultValue={values.instagram} placeholder="yourhandle" />
        </label>

        <label className="field">
          <span className="field-label">Twitter</span>
          <input name="twitter" defaultValue={values.twitter} placeholder="yourhandle" />
        </label>

        <label className="field">
          <span className="field-label">Birthday</span>
          <input name="birthday" type="date" defaultValue={values.birthday} />
        </label>

        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>

        {state.status === "saved" ? (
          <p className="rsvp-status" role="status">
            {state.message}
          </p>
        ) : null}
        {state.status === "error" && !errorField ? (
          <p className="rsvp-error" role="alert">
            {state.message}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}

export function PreferencesForm({
  values,
}: {
  values: { inApp: boolean; email: boolean; push: boolean; sms: boolean };
}) {
  const [state, action, pending] = useActionState(savePreferencesAction, preferencesInitial);

  return (
    <form action={action}>
      <fieldset>
        <legend>Notifications</legend>

        <label className="inline-label">
          <input name="inApp" type="checkbox" defaultChecked={values.inApp} />
          In the app
        </label>

        <label className="inline-label">
          <input name="email" type="checkbox" defaultChecked={values.email} />
          Email
        </label>

        <label className="inline-label">
          <input name="push" type="checkbox" defaultChecked={values.push} />
          Push
        </label>

        <label className="inline-label">
          <input name="sms" type="checkbox" defaultChecked={values.sms} />
          SMS
        </label>

        <span className="field-hint">
          In-app notifications are delivered today. Email, push, and SMS are queued for delivery and
          start arriving as soon as each channel is switched on.
        </span>

        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save notification settings"}
        </button>

        {state.status === "saved" ? (
          <p className="rsvp-status" role="status">
            {state.message}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}
