import type { EventInstance, EventSeries, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { seriesImageAt } from "@/lib/domain/event-images";
import {
  eventSeriesCreateSchema,
  recurrenceSchema,
  type EventSeriesCreateRequest,
  type InstanceUpdateRequest,
  type SeriesUpdateRequest,
} from "@/lib/api/contracts";
import {
  buildInstances,
  buildRecurrenceSummary,
  DEFAULT_MATERIALIZE_LIMIT,
  MATERIALIZE_HORIZON_DAYS,
  MAX_HORIZON_YEARS,
  recurrenceHardCeiling,
  type RecurrenceRuleInput,
} from "@/lib/domain/recurrence";
import { localDateTimeToFloatingDate, zonedTimeToUtc } from "@/lib/domain/timezone";
import { recordNotifications, type NotificationIntent } from "./notifications";

export class SeriesError extends Error {
  constructor(
    readonly code: "not_found" | "forbidden" | "conflict" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "SeriesError";
  }
}

export type SeriesWithInstances = EventSeries & { instances: EventInstance[] };

/** Reads the stored JSON rule back as a validated value rather than a cast. */
export function readRecurrence(series: Pick<EventSeries, "recurrenceRule">): RecurrenceRuleInput {
  return recurrenceSchema.parse(series.recurrenceRule);
}

export function occurrenceTitle(
  series: Pick<EventSeries, "title" | "description" | "locationName">,
  instance: Pick<EventInstance, "overrideTitle" | "overrideDescription" | "overrideLocationName">,
) {
  return {
    title: instance.overrideTitle ?? series.title,
    description: instance.overrideDescription ?? series.description,
    locationName: instance.overrideLocationName ?? series.locationName,
  };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function createSeries(
  organizerId: string,
  input: EventSeriesCreateRequest,
): Promise<SeriesWithInstances> {
  const parsed = eventSeriesCreateSchema.parse(input);

  const occurrences = plannedOccurrences({
    startsAtLocal: parsed.startsAtLocal,
    durationMinutes: parsed.durationMinutes,
    timezone: parsed.timezone,
    recurrence: parsed.recurrence,
  });

  if (occurrences.length === 0) {
    throw new SeriesError(
      "invalid",
      "That recurrence produces no occurrences. Check the start date and the end date.",
    );
  }

  const series = await prisma.$transaction(async (tx) => {
    const created = await tx.eventSeries.create({
      data: {
        organizerId,
        title: parsed.title,
        description: parsed.description ?? null,
        coverImage: parsed.coverImage ?? null,
        locationName: parsed.locationName ?? null,
        locationUrl: parsed.locationUrl ?? null,
        timezone: parsed.timezone,
        startsAtLocal: parsed.startsAtLocal,
        durationMinutes: parsed.durationMinutes,
        capacity: parsed.capacity ?? null,
        waitlistEnabled: parsed.waitlistEnabled,
        visibility: parsed.visibility,
        recurrenceRule: parsed.recurrence,
        recurrenceUntil: parsed.recurrence.until
          ? zonedTimeToUtc(parsed.recurrence.until, parsed.timezone)
          : null,
        recurrenceCount: parsed.recurrence.count ?? null,
        maxHorizonYears: MAX_HORIZON_YEARS,
        materializedThrough: materializedThroughFor(occurrences),
        status: "active",
      },
    });

    await tx.eventInstance.createMany({
      data: occurrences.map((occurrence) => ({
        seriesId: created.id,
        startsAt: new Date(occurrence.startsAt),
        endsAt: new Date(occurrence.endsAt),
        localDate: occurrence.localDate,
      })),
      skipDuplicates: true,
    });

    if (parsed.inviteEmails.length > 0) {
      await tx.eventInvite.createMany({
        data: [...new Set(parsed.inviteEmails.map((email) => email.trim().toLowerCase()))].map(
          (email) => ({ seriesId: created.id, email, invitedById: organizerId }),
        ),
        skipDuplicates: true,
      });
    }

    return created;
  });

  const instances = await prisma.eventInstance.findMany({
    where: { seriesId: series.id },
    orderBy: { startsAt: "asc" },
  });

  await recordNotifications([
    {
      type: "event_series_created",
      seriesId: series.id,
      actorId: organizerId,
      dedupeKey: `event_series_created:${series.id}`,
      payload: {
        title: series.title,
        recurrence: buildRecurrenceSummary(parsed.recurrence),
      },
      recipientIds: [organizerId],
    },
    ...(await inviteIntents(series, parsed.inviteEmails, organizerId)),
  ]);

  return { ...series, instances };
}

/**
 * Invited people only get an in-app notification if they already have an
 * account; the rest have an invite row waiting for whenever this site grows a
 * way to sign in again.
 */
async function inviteIntents(
  series: EventSeries,
  emails: string[],
  actorId: string,
): Promise<NotificationIntent[]> {
  if (emails.length === 0) {
    return [];
  }

  const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
  const existing = await prisma.user.findMany({
    where: { email: { in: normalized } },
    select: { id: true },
  });

  if (existing.length === 0) {
    return [];
  }

  return [
    {
      type: "user_invited",
      seriesId: series.id,
      actorId,
      payload: { title: series.title },
      recipientIds: existing.map((user) => user.id).filter((id) => id !== actorId),
    },
  ];
}

// ---------------------------------------------------------------------------
// Rolling-horizon materialization
// ---------------------------------------------------------------------------

type PlanInput = {
  startsAtLocal: string;
  durationMinutes: number;
  timezone: string;
  recurrence: RecurrenceRuleInput;
  from?: Date;
  through?: Date;
  limit?: number;
};

function plannedOccurrences(input: PlanInput) {
  return buildInstances({
    startsAtLocal: input.startsAtLocal,
    durationMinutes: input.durationMinutes,
    timezone: input.timezone,
    recurrence: input.recurrence,
    from: input.from,
    through: input.through ?? defaultHorizon(),
    limit: input.limit ?? DEFAULT_MATERIALIZE_LIMIT,
    horizonYears: MAX_HORIZON_YEARS,
  });
}

function defaultHorizon(): Date {
  return new Date(Date.now() + MATERIALIZE_HORIZON_DAYS * 24 * 60 * 60 * 1000);
}

function materializedThroughFor(occurrences: Array<{ startsAt: string }>): Date | null {
  const last = occurrences[occurrences.length - 1];
  return last ? new Date(last.startsAt) : null;
}

/**
 * Tops up a series so the next year of occurrences exists, and returns how many
 * rows were added.
 *
 * Called whenever a series is read. A never-ending weekly event would be 520
 * rows over ten years; generating them lazily keeps that cost proportional to
 * how far anyone actually looks. The unique index on (seriesId, startsAt) makes
 * repeated calls harmless, so concurrent readers cannot double-create.
 */
export async function materializeSeries(seriesId: string): Promise<number> {
  const series = await prisma.eventSeries.findUnique({ where: { id: seriesId } });

  // Only an active series has settled dates. A draft is still being planned,
  // so generating occurrences for it would invent dates nobody has agreed to.
  if (!series || series.status !== "active") {
    return 0;
  }

  const horizon = defaultHorizon();
  const ceiling = recurrenceHardCeiling(series.startsAtLocal, series.timezone);

  if (series.materializedThrough && series.materializedThrough >= horizon) {
    return 0;
  }

  if (series.materializedThrough && series.materializedThrough >= ceiling) {
    return 0;
  }

  const occurrences = plannedOccurrences({
    startsAtLocal: series.startsAtLocal,
    durationMinutes: series.durationMinutes,
    timezone: series.timezone,
    recurrence: readRecurrence(series),
    // Resume from the last generated occurrence rather than re-walking from the
    // beginning of the series, which for an old series could be thousands of
    // dates before reaching new ground.
    from: series.materializedThrough
      ? new Date(series.materializedThrough.getTime() + 1_000)
      : undefined,
    through: horizon,
    limit: DEFAULT_MATERIALIZE_LIMIT,
  });

  if (occurrences.length === 0) {
    // Nothing left to generate: the rule has run out. Record the horizon so
    // later reads stop re-walking a finished series.
    await prisma.eventSeries.update({
      where: { id: seriesId },
      data: { materializedThrough: horizon },
    });
    return 0;
  }

  // Claim this batch's slots in the series' photo deck before writing any of
  // them. Incrementing and reading back in one statement means two top-ups
  // running at once get disjoint ranges instead of both reading the same
  // starting point; burning a slot on a row that turns out to be a duplicate
  // is fine, handing the same slot out twice is not.
  const { coverCursor } = await prisma.eventSeries.update({
    where: { id: seriesId },
    data: { coverCursor: { increment: occurrences.length } },
    select: { coverCursor: true },
  });
  const firstSlot = coverCursor - occurrences.length;

  const result = await prisma.eventInstance.createMany({
    data: occurrences.map((occurrence, position) => ({
      seriesId,
      startsAt: new Date(occurrence.startsAt),
      endsAt: new Date(occurrence.endsAt),
      localDate: occurrence.localDate,
      coverIndex: firstSlot + position,
      coverImage: seriesImageAt(seriesId, firstSlot + position),
    })),
    skipDuplicates: true,
  });

  await prisma.eventSeries.update({
    where: { id: seriesId },
    data: { materializedThrough: materializedThroughFor(occurrences) },
  });

  return result.count;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getSeries(seriesId: string): Promise<EventSeries | null> {
  return prisma.eventSeries.findUnique({ where: { id: seriesId } });
}

export async function requireOrganizer(seriesId: string, userId: string): Promise<EventSeries> {
  const series = await getSeries(seriesId);

  if (!series) {
    throw new SeriesError("not_found", "Event not found.");
  }

  if (series.organizerId !== userId) {
    throw new SeriesError("forbidden", "Only the host can change this event.");
  }

  return series;
}

export async function listInstances(
  seriesId: string,
  range: { from?: Date; to?: Date; take?: number } = {},
): Promise<EventInstance[]> {
  return prisma.eventInstance.findMany({
    where: {
      seriesId,
      startsAt: {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      },
    },
    orderBy: { startsAt: "asc" },
    take: range.take ?? 200,
  });
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

const scheduleFields = ["timezone", "startsAtLocal", "durationMinutes", "recurrence"] as const;

function touchesSchedule(patch: SeriesUpdateRequest): boolean {
  return scheduleFields.some((field) => patch[field] !== undefined);
}

/**
 * Applies an edit to a series.
 *
 * `all` rewrites the series in place. `future` splits it: the original is
 * truncated just before the chosen occurrence and a new series carries the new
 * values forward. Splitting is what keeps "change all future occurrences" from
 * silently rewriting history — past occurrences and the RSVPs attached to them
 * stay on the original series, untouched.
 */
export async function updateSeries(
  seriesId: string,
  userId: string,
  patch: SeriesUpdateRequest,
): Promise<{ series: EventSeries; splitSeriesId?: string }> {
  const series = await requireOrganizer(seriesId, userId);

  if (series.status === "cancelled") {
    throw new SeriesError("conflict", "This event has been cancelled.");
  }

  if (patch.scope === "future") {
    return splitSeries(series, patch, userId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.eventSeries.update({
      where: { id: series.id },
      data: seriesData(series, patch),
    });

    if (touchesSchedule(patch)) {
      await regenerateFutureInstances(tx, next);
    }

    // A series-wide edit is the authoritative value, so per-occurrence
    // overrides of the same fields are cleared rather than left to shadow it.
    await clearOverridesFor(tx, series.id, patch, new Date());

    return next;
  });

  await notifyAttendees(series.id, {
    type: "instance_changed",
    actorId: userId,
    payload: { title: updated.title },
    from: new Date(),
  });

  return { series: updated };
}

function seriesData(
  series: EventSeries,
  patch: SeriesUpdateRequest,
): Prisma.EventSeriesUpdateInput {
  const timezone = patch.timezone ?? series.timezone;
  const recurrence = patch.recurrence ?? readRecurrence(series);

  const data: Prisma.EventSeriesUpdateInput = {};

  if (patch.title !== undefined) data.title = patch.title;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.coverImage !== undefined) data.coverImage = patch.coverImage;
  if (patch.locationName !== undefined) data.locationName = patch.locationName;
  if (patch.locationUrl !== undefined) data.locationUrl = patch.locationUrl;
  if (patch.capacity !== undefined) data.capacity = patch.capacity;
  if (patch.waitlistEnabled !== undefined) data.waitlistEnabled = patch.waitlistEnabled;
  if (patch.timezone !== undefined) data.timezone = patch.timezone;
  if (patch.startsAtLocal !== undefined) data.startsAtLocal = patch.startsAtLocal;
  if (patch.durationMinutes !== undefined) data.durationMinutes = patch.durationMinutes;

  if (patch.recurrence !== undefined) {
    data.recurrenceRule = patch.recurrence;
    data.recurrenceUntil = recurrence.until ? zonedTimeToUtc(recurrence.until, timezone) : null;
    data.recurrenceCount = recurrence.count ?? null;
  }

  return data;
}

async function clearOverridesFor(
  tx: Prisma.TransactionClient,
  seriesId: string,
  patch: SeriesUpdateRequest,
  from: Date,
): Promise<void> {
  const data: Prisma.EventInstanceUpdateManyMutationInput = {};

  if (patch.title !== undefined) data.overrideTitle = null;
  if (patch.description !== undefined) data.overrideDescription = null;
  if (patch.locationName !== undefined) data.overrideLocationName = null;

  if (Object.keys(data).length === 0) {
    return;
  }

  await tx.eventInstance.updateMany({
    where: { seriesId, startsAt: { gte: from } },
    data,
  });
}

/**
 * Rebuilds the not-yet-happened occurrences of a series after its schedule
 * changed. Past occurrences are never touched: they already happened, and the
 * RSVPs on them are a record of who was there.
 */
async function regenerateFutureInstances(
  tx: Prisma.TransactionClient,
  series: EventSeries,
  from: Date = new Date(),
): Promise<void> {
  await tx.eventInstance.deleteMany({
    where: { seriesId: series.id, startsAt: { gte: from } },
  });

  const occurrences = plannedOccurrences({
    startsAtLocal: series.startsAtLocal,
    durationMinutes: series.durationMinutes,
    timezone: series.timezone,
    recurrence: readRecurrence(series),
    from,
  });

  if (occurrences.length > 0) {
    await tx.eventInstance.createMany({
      data: occurrences.map((occurrence) => ({
        seriesId: series.id,
        startsAt: new Date(occurrence.startsAt),
        endsAt: new Date(occurrence.endsAt),
        localDate: occurrence.localDate,
      })),
      skipDuplicates: true,
    });
  }

  await tx.eventSeries.update({
    where: { id: series.id },
    data: { materializedThrough: materializedThroughFor(occurrences) },
  });
}

async function splitSeries(
  series: EventSeries,
  patch: SeriesUpdateRequest,
  userId: string,
): Promise<{ series: EventSeries; splitSeriesId: string }> {
  const cutoffInstance = await prisma.eventInstance.findUnique({
    where: { id: patch.fromInstanceId! },
  });

  if (!cutoffInstance || cutoffInstance.seriesId !== series.id) {
    throw new SeriesError("not_found", "That occurrence is not part of this event.");
  }

  const cutoff = cutoffInstance.startsAt;
  const timezone = patch.timezone ?? series.timezone;
  const recurrence = patch.recurrence ?? readRecurrence(series);

  // The new series starts at the cutoff occurrence unless the edit moved it.
  const startsAtLocal =
    patch.startsAtLocal ?? localStartOf(cutoffInstance, series.timezone, timezone);

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.eventSeries.create({
      data: {
        organizerId: series.organizerId,
        title: patch.title ?? series.title,
        description: patch.description !== undefined ? patch.description : series.description,
        coverImage: patch.coverImage !== undefined ? patch.coverImage : series.coverImage,
        locationName:
          patch.locationName !== undefined ? patch.locationName : series.locationName,
        locationUrl: patch.locationUrl !== undefined ? patch.locationUrl : series.locationUrl,
        timezone,
        startsAtLocal,
        durationMinutes: patch.durationMinutes ?? series.durationMinutes,
        capacity: patch.capacity !== undefined ? patch.capacity : series.capacity,
        waitlistEnabled: patch.waitlistEnabled ?? series.waitlistEnabled,
        visibility: series.visibility,
        recurrenceRule: recurrence,
        recurrenceUntil: recurrence.until ? zonedTimeToUtc(recurrence.until, timezone) : null,
        recurrenceCount: recurrence.count ?? null,
        maxHorizonYears: MAX_HORIZON_YEARS,
        status: "active",
      },
    });

    const occurrences = plannedOccurrences({
      startsAtLocal: created.startsAtLocal,
      durationMinutes: created.durationMinutes,
      timezone: created.timezone,
      recurrence,
    });

    if (occurrences.length > 0) {
      await tx.eventInstance.createMany({
        data: occurrences.map((occurrence) => ({
          seriesId: created.id,
          startsAt: new Date(occurrence.startsAt),
          endsAt: new Date(occurrence.endsAt),
          localDate: occurrence.localDate,
        })),
        skipDuplicates: true,
      });

      await tx.eventSeries.update({
        where: { id: created.id },
        data: { materializedThrough: materializedThroughFor(occurrences) },
      });
    }

    // Truncate the original at the cutoff and drop the occurrences the new
    // series now owns.
    await tx.eventInstance.deleteMany({
      where: { seriesId: series.id, startsAt: { gte: cutoff } },
    });

    const truncated = await tx.eventSeries.update({
      where: { id: series.id },
      data: {
        recurrenceUntil: new Date(cutoff.getTime() - 1_000),
        materializedThrough: new Date(cutoff.getTime() - 1_000),
      },
    });

    return { truncated, created };
  });

  await recordNotifications([
    {
      type: "instance_changed",
      seriesId: result.created.id,
      actorId: userId,
      payload: { title: result.created.title },
      recipientIds: [series.organizerId],
    },
  ]);

  return { series: result.truncated, splitSeriesId: result.created.id };
}

/** The cutoff occurrence's wall-clock start, re-expressed in a new timezone. */
function localStartOf(instance: EventInstance, fromTimezone: string, toTimezone: string): string {
  if (fromTimezone === toTimezone) {
    return isoToLocal(instance.startsAt, fromTimezone);
  }
  return isoToLocal(instance.startsAt, toTimezone);
}

function isoToLocal(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

// ---------------------------------------------------------------------------
// Single-occurrence edits
// ---------------------------------------------------------------------------

export async function updateInstance(
  instanceId: string,
  userId: string,
  patch: InstanceUpdateRequest,
): Promise<EventInstance> {
  const instance = await prisma.eventInstance.findUnique({
    where: { id: instanceId },
    include: { series: true },
  });

  if (!instance) {
    throw new SeriesError("not_found", "Occurrence not found.");
  }

  if (instance.series.organizerId !== userId) {
    throw new SeriesError("forbidden", "Only the host can change this occurrence.");
  }

  if (instance.status === "cancelled") {
    throw new SeriesError("conflict", "This occurrence has been cancelled.");
  }

  const data: Prisma.EventInstanceUpdateInput = {};

  if (patch.title !== undefined) data.overrideTitle = patch.title;
  if (patch.description !== undefined) data.overrideDescription = patch.description;
  if (patch.locationName !== undefined) data.overrideLocationName = patch.locationName;

  if (patch.startsAtLocal !== undefined || patch.durationMinutes !== undefined) {
    const startsAt = patch.startsAtLocal
      ? zonedTimeToUtc(patch.startsAtLocal, instance.series.timezone)
      : instance.startsAt;
    const duration = patch.durationMinutes ?? instance.series.durationMinutes;

    data.startsAt = startsAt;
    data.endsAt = new Date(startsAt.getTime() + duration * 60_000);
    data.localDate = (patch.startsAtLocal ?? isoToLocal(startsAt, instance.series.timezone)).slice(
      0,
      10,
    );
    // `moved` marks an occurrence that no longer sits where the rule puts it,
    // so regenerating the series does not quietly snap it back.
    data.status = "moved";
  }

  const updated = await prisma.eventInstance.update({ where: { id: instanceId }, data });

  await notifyInstanceAttendees(instanceId, {
    type: "instance_changed",
    actorId: userId,
    seriesId: instance.seriesId,
    payload: {
      title: patch.title ?? instance.overrideTitle ?? instance.series.title,
      when: updated.localDate,
    },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

export async function cancelInstance(instanceId: string, userId: string): Promise<EventInstance> {
  const instance = await prisma.eventInstance.findUnique({
    where: { id: instanceId },
    include: { series: true },
  });

  if (!instance) {
    throw new SeriesError("not_found", "Occurrence not found.");
  }

  if (instance.series.organizerId !== userId) {
    throw new SeriesError("forbidden", "Only the host can cancel this occurrence.");
  }

  if (instance.status === "cancelled") {
    return instance;
  }

  const cancelled = await prisma.eventInstance.update({
    where: { id: instanceId },
    data: { status: "cancelled" },
  });

  await notifyInstanceAttendees(instanceId, {
    type: "instance_cancelled",
    actorId: userId,
    seriesId: instance.seriesId,
    dedupeKey: `instance_cancelled:${instanceId}`,
    payload: {
      title: instance.overrideTitle ?? instance.series.title,
      when: instance.localDate,
    },
  });

  return cancelled;
}

export async function cancelSeries(
  seriesId: string,
  userId: string,
  options: { scope: "future" | "all"; fromInstanceId?: string },
): Promise<EventSeries> {
  const series = await requireOrganizer(seriesId, userId);

  let cutoff = new Date();

  if (options.fromInstanceId) {
    const instance = await prisma.eventInstance.findUnique({
      where: { id: options.fromInstanceId },
    });

    if (!instance || instance.seriesId !== seriesId) {
      throw new SeriesError("not_found", "That occurrence is not part of this event.");
    }

    cutoff = instance.startsAt;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.eventInstance.updateMany({
      where: {
        seriesId,
        status: { not: "cancelled" },
        // `all` cancels the record of the whole series including occurrences
        // that already ran; `future` leaves history alone.
        ...(options.scope === "future" ? { startsAt: { gte: cutoff } } : {}),
      },
      data: { status: "cancelled" },
    });

    return tx.eventSeries.update({
      where: { id: seriesId },
      data: {
        status: "cancelled",
        recurrenceUntil: options.scope === "future" ? cutoff : series.recurrenceUntil,
      },
    });
  });

  await notifyAttendees(seriesId, {
    type: "series_cancelled",
    actorId: userId,
    payload: { title: series.title },
    from: options.scope === "future" ? cutoff : undefined,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

async function notifyAttendees(
  seriesId: string,
  options: {
    type: NotificationIntent["type"];
    actorId: string;
    payload: NotificationIntent["payload"];
    from?: Date;
    dedupeKey?: string;
  },
): Promise<void> {
  const rsvps = await prisma.eventRsvp.findMany({
    where: {
      instance: {
        seriesId,
        ...(options.from ? { startsAt: { gte: options.from } } : {}),
      },
      status: { in: ["going", "maybe", "waitlisted"] },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  const recipientIds = rsvps.map((rsvp) => rsvp.userId).filter((id) => id !== options.actorId);

  if (recipientIds.length === 0) {
    return;
  }

  await recordNotifications([
    {
      type: options.type,
      seriesId,
      actorId: options.actorId,
      dedupeKey: options.dedupeKey,
      payload: options.payload,
      recipientIds,
    },
  ]);
}

async function notifyInstanceAttendees(
  instanceId: string,
  options: {
    type: NotificationIntent["type"];
    actorId: string;
    seriesId: string;
    payload: NotificationIntent["payload"];
    dedupeKey?: string;
  },
): Promise<void> {
  const rsvps = await prisma.eventRsvp.findMany({
    where: { instanceId, status: { in: ["going", "maybe", "waitlisted"] } },
    select: { userId: true },
  });

  const recipientIds = rsvps.map((rsvp) => rsvp.userId).filter((id) => id !== options.actorId);

  if (recipientIds.length === 0) {
    return;
  }

  await recordNotifications([
    {
      type: options.type,
      seriesId: options.seriesId,
      instanceId,
      actorId: options.actorId,
      dedupeKey: options.dedupeKey,
      payload: options.payload,
      recipientIds,
    },
  ]);
}

/** Used by the create form to show what a rule will produce before publishing. */
export function previewOccurrences(input: {
  startsAtLocal: string;
  durationMinutes: number;
  timezone: string;
  recurrence: RecurrenceRuleInput;
  limit?: number;
}) {
  return buildInstances({
    ...input,
    limit: input.limit ?? 12,
    horizonYears: MAX_HORIZON_YEARS,
  });
}

/** Guards against a rule whose first occurrence is already impossible. */
export function firstOccurrenceIsValid(startsAtLocal: string): boolean {
  try {
    localDateTimeToFloatingDate(startsAtLocal);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export type OccurrenceSummary = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  localDate: string;
  status: EventInstance["status"];
  overrideTitle: string | null;
  /** Whether it has already started. Resolved here so pages stay pure. */
  past: boolean;
};

/**
 * Occurrences with the clock already applied.
 *
 * Reading the current time is a side effect, and a component that renders one
 * is not idempotent. Resolving it in the data layer keeps "has this happened
 * yet" a fact the page is handed rather than something it computes mid-render.
 */
export async function listOccurrenceSummaries(
  seriesId: string,
  range: { from?: Date; to?: Date; take?: number } = {},
): Promise<OccurrenceSummary[]> {
  const now = Date.now();
  const instances = await listInstances(seriesId, {
    from: range.from ?? new Date(now),
    to: range.to,
    take: range.take,
  });

  return instances.map((instance) => ({
    id: instance.id,
    startsAt: instance.startsAt,
    endsAt: instance.endsAt,
    localDate: instance.localDate,
    status: instance.status,
    overrideTitle: instance.overrideTitle,
    past: instance.startsAt.getTime() < now,
  }));
}

export type InstanceView = {
  instance: EventInstance;
  series: EventSeries;
  cancelled: boolean;
};

/**
 * One occurrence, checked against the series id in the URL so a valid
 * occurrence id cannot be rendered underneath someone else's event.
 */
export async function loadInstanceView(
  seriesId: string,
  instanceId: string,
): Promise<InstanceView | null> {
  const instance = await prisma.eventInstance.findUnique({
    where: { id: instanceId },
    include: { series: true },
  });

  if (!instance || instance.seriesId !== seriesId || instance.series.visibility !== "public") {
    return null;
  }

  // No `past` here any more. Whether an occurrence has happened depends on when
  // the page is read, not on when it was built, so that one is worked out in
  // the browser from `instance.startsAt`.
  return {
    instance,
    series: instance.series,
    cancelled: instance.status === "cancelled" || instance.series.status === "cancelled",
  };
}

/**
 * Where a series URL sends someone: its next date, or the most recent one if
 * they have all happened, or the home page if it has no dates at all.
 */
export async function nextOccurrenceHref(seriesId: string): Promise<string> {
  const upcoming = await prisma.eventInstance.findFirst({
    where: { seriesId, startsAt: { gte: new Date() }, status: { not: "cancelled" } },
    orderBy: { startsAt: "asc" },
  });

  const instance =
    upcoming ??
    (await prisma.eventInstance.findFirst({ where: { seriesId }, orderBy: { startsAt: "desc" } }));

  return instance ? `/events/${seriesId}/${instance.id}` : "/";
}
