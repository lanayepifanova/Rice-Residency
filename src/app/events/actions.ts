"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eventSeriesCreateSchema, recurrenceSchema } from "@/lib/api/contracts";
import { requireUser } from "@/lib/auth";
import { buildRecurrenceSummary, type EventInstancePreview } from "@/lib/domain/recurrence";
import { RsvpError } from "@/lib/domain/rsvp";
import {
  cancelInstance,
  cancelSeries,
  createSeries,
  previewOccurrences,
  SeriesError,
  updateInstance,
  updateSeries,
} from "@/lib/server/series";
import { submitRsvp, toServiceError } from "@/lib/server/rsvp";
import { createShareLink, revokeShareLink } from "@/lib/server/share-links";

// ---------------------------------------------------------------------------
// Creating an event
// ---------------------------------------------------------------------------

export type CreateEventState =
  | { status: "idle" }
  | { status: "invalid"; message: string; errors: Record<string, string> }
  | {
      status: "preview";
      summary: string;
      timezone: string;
      occurrences: EventInstancePreview[];
    };

/**
 * Backs both buttons on the create form. `preview` validates and expands the
 * rule without writing anything; `publish` creates the series. One action
 * keeps the form's error handling in a single place, and means a preview and a
 * publish can never disagree about what the rule means.
 */
export async function submitEventForm(
  _previous: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const user = await requireUser("/events/new");
  const intent = string(formData.get("intent")) === "publish" ? "publish" : "preview";

  const parsed = eventSeriesCreateSchema.safeParse(readEventForm(formData));

  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Check the highlighted fields.",
      errors: fieldErrors(parsed.error.issues),
    };
  }

  if (intent === "preview") {
    const occurrences = previewOccurrences(parsed.data);

    if (occurrences.length === 0) {
      return {
        status: "invalid",
        message: "That recurrence produces no occurrences. Check the start date and the end date.",
        errors: { until: "Nothing falls inside this range." },
      };
    }

    return {
      status: "preview",
      summary: buildRecurrenceSummary(parsed.data.recurrence),
      timezone: parsed.data.timezone,
      occurrences,
    };
  }

  let seriesId: string;

  try {
    const series = await createSeries(user.id, parsed.data);
    seriesId = series.id;
  } catch (error) {
    if (error instanceof SeriesError) {
      return { status: "invalid", message: error.message, errors: {} };
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/explore");
  redirect(`/events/${seriesId}?created=1`);
}

function readEventForm(formData: FormData) {
  const capacity = string(formData.get("capacity"));
  const until = string(formData.get("until"));
  const byDay = formData.getAll("byDay").map(String);
  const count = string(formData.get("count"));

  return {
    title: string(formData.get("title")),
    description: optional(formData.get("description")),
    coverImage: optional(formData.get("coverImage")),
    locationName: optional(formData.get("locationName")),
    locationUrl: optional(formData.get("locationUrl")),
    timezone: string(formData.get("timezone")),
    startsAtLocal: string(formData.get("startsAtLocal")),
    durationMinutes: Number(string(formData.get("durationMinutes")) || 0),
    capacity: capacity ? Number(capacity) : null,
    inviteEmails: parseEmails(string(formData.get("inviteEmails"))),
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    visibility: "public" as const,
    recurrence: {
      freq: string(formData.get("freq")),
      interval: Number(string(formData.get("interval")) || 1),
      byDay: byDay.length ? byDay : undefined,
      until: until || null,
      count: count ? Number(count) : null,
    },
  };
}

function parseEmails(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function fieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    // Recurrence problems are reported against the control the person actually
    // sees, so "recurrence.interval" surfaces on the interval input.
    const key = issue.path.map(String).join(".").replace(/^recurrence\./, "");
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

export type RsvpState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

export async function submitRsvpAction(
  _previous: RsvpState,
  formData: FormData,
): Promise<RsvpState> {
  const instanceId = string(formData.get("instanceId"));
  const seriesId = string(formData.get("seriesId"));
  const requested = string(formData.get("status"));

  if (requested !== "going" && requested !== "maybe" && requested !== "busy") {
    return { status: "error", message: "Pick going, maybe, or busy." };
  }

  const user = await requireUser(`/events/${seriesId}/${instanceId}`);
  const guestCount = Number(string(formData.get("guestCount")) || 0);

  if (!Number.isInteger(guestCount) || guestCount < 0) {
    return { status: "error", message: "Guests must be a whole number, zero or more." };
  }

  try {
    const outcome = await submitRsvp({
      instanceId,
      userId: user.id,
      status: requested,
      guestCount,
    });

    revalidatePath(`/events/${seriesId}`);
    revalidatePath(`/events/${seriesId}/${instanceId}`);
    revalidatePath("/");

    return { status: "saved", message: confirmationFor(outcome.rsvp.status, outcome.rsvp.waitlistRank) };
  } catch (error) {
    if (error instanceof RsvpError || error instanceof Error) {
      return { status: "error", message: toServiceError(error).message };
    }
    throw error;
  }
}

function confirmationFor(status: string, waitlistRank: number | null): string {
  switch (status) {
    case "going":
      return "You are going.";
    case "maybe":
      return "Saved as maybe.";
    case "busy":
      return "Saved as busy.";
    case "waitlisted":
      return `This occurrence is full, so you are number ${waitlistRank ?? 1} on the waitlist.`;
    default:
      return "RSVP saved.";
  }
}

// ---------------------------------------------------------------------------
// Host controls
// ---------------------------------------------------------------------------

export type HostActionState = { status: "idle" } | { status: "error"; message: string };

/** Cancels one occurrence, everything from one occurrence on, or the lot. */
export async function cancelAction(
  _previous: HostActionState,
  formData: FormData,
): Promise<HostActionState> {
  const seriesId = string(formData.get("seriesId"));
  const instanceId = string(formData.get("instanceId"));
  const scope = string(formData.get("scope"));

  const user = await requireUser(`/events/${seriesId}`);

  try {
    if (scope === "this") {
      await cancelInstance(instanceId, user.id);
    } else if (scope === "future") {
      await cancelSeries(seriesId, user.id, { scope: "future", fromInstanceId: instanceId || undefined });
    } else if (scope === "all") {
      await cancelSeries(seriesId, user.id, { scope: "all" });
    } else {
      return { status: "error", message: "Choose which occurrences to cancel." };
    }
  } catch (error) {
    if (error instanceof SeriesError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath(`/events/${seriesId}`);
  revalidatePath("/");
  revalidatePath("/explore");

  return { status: "idle" };
}

export type EditState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

/**
 * The scoped edit. `this` writes an override on one occurrence; `all` rewrites
 * the series; `future` splits the series so occurrences that already happened
 * keep the details they were published with.
 */
export async function editAction(_previous: EditState, formData: FormData): Promise<EditState> {
  const seriesId = string(formData.get("seriesId"));
  const instanceId = string(formData.get("instanceId"));
  const scope = string(formData.get("scope"));

  const user = await requireUser(`/events/${seriesId}`);

  const title = string(formData.get("title"));
  const description = string(formData.get("description"));
  const locationName = string(formData.get("locationName"));
  const capacityRaw = string(formData.get("capacity"));

  if (!title) {
    return { status: "error", message: "The title cannot be empty." };
  }

  try {
    if (scope === "this") {
      await updateInstance(instanceId, user.id, {
        title,
        description: description || null,
        locationName: locationName || null,
      });
    } else if (scope === "all" || scope === "future") {
      const recurrenceRaw = string(formData.get("recurrence"));

      await updateSeries(seriesId, user.id, {
        scope,
        fromInstanceId: scope === "future" ? instanceId : undefined,
        title,
        description: description || null,
        locationName: locationName || null,
        capacity: capacityRaw ? Number(capacityRaw) : null,
        waitlistEnabled: formData.get("waitlistEnabled") === "on",
        ...(recurrenceRaw ? { recurrence: recurrenceSchema.parse(JSON.parse(recurrenceRaw)) } : {}),
      });
    } else {
      return { status: "error", message: "Choose which occurrences this change applies to." };
    }
  } catch (error) {
    if (error instanceof SeriesError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath(`/events/${seriesId}`);
  revalidatePath("/");

  return { status: "saved", message: savedMessageFor(scope) };
}

function savedMessageFor(scope: string): string {
  switch (scope) {
    case "this":
      return "Saved for this occurrence only.";
    case "future":
      return "Saved for this and all future occurrences.";
    default:
      return "Saved for the entire series.";
  }
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export async function createShareLinkAction(formData: FormData): Promise<void> {
  const seriesId = string(formData.get("seriesId"));
  const instanceId = string(formData.get("instanceId"));

  const user = await requireUser(`/events/${seriesId}`);

  await createShareLink(
    instanceId ? { kind: "instance", instanceId } : { kind: "series", seriesId },
    user.id,
  );

  revalidatePath(`/events/${seriesId}`);
}

export async function revokeShareLinkAction(formData: FormData): Promise<void> {
  const seriesId = string(formData.get("seriesId"));
  const linkId = string(formData.get("linkId"));

  const user = await requireUser(`/events/${seriesId}`);

  await revokeShareLink(linkId, user.id);

  revalidatePath(`/events/${seriesId}`);
}

function string(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: FormDataEntryValue | null): string | undefined {
  const text = string(value);
  return text ? text : undefined;
}
