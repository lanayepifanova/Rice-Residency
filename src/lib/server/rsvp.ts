import type { EventInstance, EventRsvp, EventSeries, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  applyRsvp,
  planWaitlistPromotions,
  RsvpError,
  seatsFor,
  summarizeCapacity,
  type CapacitySnapshot,
  type RequestedRsvpStatus,
} from "@/lib/domain/rsvp";
import { recordNotifications, type NotificationIntent } from "./notifications";

export class RsvpServiceError extends Error {
  constructor(
    readonly code: "not_found" | "conflict" | "capacity_full" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "RsvpServiceError";
  }
}

export type RsvpOutcome = {
  rsvp: EventRsvp;
  capacity: CapacitySnapshot;
  promotedUserIds: string[];
};

export type SubmitRsvpInput = {
  instanceId: string;
  userId: string;
  status: RequestedRsvpStatus;
  guestCount: number;
};

/**
 * Records an RSVP and settles the waitlist that the change may have moved.
 *
 * The whole thing runs inside one transaction that begins by taking a row lock
 * on the occurrence. Capacity is the one place where a read-then-write race
 * oversells an event: two people can both read "one seat left" and both take
 * it. The lock makes RSVPs to the same occurrence queue behind each other,
 * while RSVPs to different occurrences stay fully parallel.
 */
export async function submitRsvp(input: SubmitRsvpInput): Promise<RsvpOutcome> {
  const instance = await prisma.eventInstance.findUnique({
    where: { id: input.instanceId },
    include: { series: true },
  });

  if (!instance) {
    throw new RsvpServiceError("not_found", "Occurrence not found.");
  }

  assertRsvpAllowed(instance, instance.series);

  const { outcome, intents } = await prisma.$transaction(async (tx) => {
    // Serializes concurrent RSVPs for this occurrence. Everything below reads
    // a capacity total that cannot change underneath it.
    await tx.$queryRaw`SELECT id FROM "EventInstance" WHERE id = ${input.instanceId} FOR UPDATE`;

    const existing = await tx.eventRsvp.findMany({ where: { instanceId: input.instanceId } });
    const previous = existing.find((rsvp) => rsvp.userId === input.userId) ?? null;

    // Domain rejections are translated here rather than at the edge, so every
    // caller of this service sees one error type with one set of codes.
    let applied;
    try {
      applied = applyRsvp({
        userId: input.userId,
        requestedStatus: input.status,
        guestCount: input.guestCount,
        capacity: instance.series.capacity,
        waitlistEnabled: instance.series.waitlistEnabled,
        existingRsvps: existing.map((rsvp) => ({
          userId: rsvp.userId,
          status: rsvp.status,
          guestCount: rsvp.guestCount,
          waitlistRank: rsvp.waitlistRank,
        })),
      });
    } catch (error) {
      throw toServiceError(error);
    }

    const rsvp = await tx.eventRsvp.upsert({
      where: { instanceId_userId: { instanceId: input.instanceId, userId: input.userId } },
      create: {
        instanceId: input.instanceId,
        userId: input.userId,
        status: applied.status,
        guestCount: applied.guestCount,
        partySize: applied.partySize,
        waitlistRank: applied.waitlistRank,
      },
      update: {
        status: applied.status,
        guestCount: applied.guestCount,
        partySize: applied.partySize,
        waitlistRank: applied.waitlistRank,
      },
    });

    const intents: NotificationIntent[] = [
      {
        type: "rsvp_changed",
        seriesId: instance.seriesId,
        instanceId: instance.id,
        actorId: input.userId,
        payload: {
          title: instance.overrideTitle ?? instance.series.title,
          when: instance.localDate,
          status: applied.status,
        },
        recipientIds: [input.userId],
      },
    ];

    // Only worth walking the waitlist when this change actually gave seats
    // back. Someone switching from "maybe" to "busy" frees nothing.
    const seatsBefore = previous ? seatsFor(previous.status, previous.guestCount) : 0;
    const seatsAfter = seatsFor(applied.status, applied.guestCount);

    if (seatsAfter < seatsBefore) {
      intents.push(
        ...(await settleWaitlist(tx, instance, instance.series, input.userId)),
      );
    }

    const settled = await tx.eventRsvp.findMany({ where: { instanceId: input.instanceId } });
    const capacity = summarizeCapacity(
      instance.series.capacity,
      settled.map((entry) => ({
        userId: entry.userId,
        status: entry.status,
        guestCount: entry.guestCount,
        waitlistRank: entry.waitlistRank,
      })),
    );

    if (capacity.isFull) {
      intents.push({
        type: "capacity_reached",
        seriesId: instance.seriesId,
        instanceId: instance.id,
        actorId: input.userId,
        // Fires once for the lifetime of the occurrence. The unique index on
        // this key is what makes it exactly once under concurrency, rather
        // than "usually once".
        dedupeKey: `capacity_reached:${instance.id}`,
        payload: {
          title: instance.overrideTitle ?? instance.series.title,
          when: instance.localDate,
        },
        recipientIds: [instance.series.organizerId],
      });
    }

    const promotedUserIds = intents
      .filter((intent) => intent.type === "waitlist_promoted")
      .flatMap((intent) => intent.recipientIds);

    return {
      outcome: { rsvp: await refresh(tx, rsvp.id), capacity, promotedUserIds },
      intents,
    };
  });

  await recordNotifications(intents);

  return outcome;
}

async function refresh(
  tx: Prisma.TransactionClient,
  rsvpId: string,
): Promise<EventRsvp> {
  const rsvp = await tx.eventRsvp.findUnique({ where: { id: rsvpId } });
  if (!rsvp) {
    throw new RsvpServiceError("conflict", "RSVP disappeared while being saved.");
  }
  return rsvp;
}

/**
 * Moves people off the waitlist into the seats that just opened, then closes
 * the gaps in the remaining positions so nobody is told they are number 4 of 2.
 */
async function settleWaitlist(
  tx: Prisma.TransactionClient,
  instance: EventInstance,
  series: EventSeries,
  actorId: string,
): Promise<NotificationIntent[]> {
  if (series.capacity === null) {
    return [];
  }

  const current = await tx.eventRsvp.findMany({ where: { instanceId: instance.id } });

  const seatsUsed = current.reduce(
    (total, rsvp) => total + seatsFor(rsvp.status, rsvp.guestCount),
    0,
  );

  const plan = planWaitlistPromotions({
    capacity: series.capacity,
    seatsUsed,
    waitlist: current
      .filter((rsvp) => rsvp.status === "waitlisted")
      .map((rsvp) => ({
        userId: rsvp.userId,
        guestCount: rsvp.guestCount,
        waitlistRank: rsvp.waitlistRank,
      })),
  });

  const intents: NotificationIntent[] = [];
  const eventPayload = {
    title: instance.overrideTitle ?? series.title,
    when: instance.localDate,
  };

  for (const promotion of plan.promoted) {
    await tx.eventRsvp.update({
      where: { instanceId_userId: { instanceId: instance.id, userId: promotion.userId } },
      data: { status: "going", partySize: promotion.partySize, waitlistRank: null },
    });

    intents.push({
      type: "waitlist_promoted",
      seriesId: series.id,
      instanceId: instance.id,
      actorId,
      payload: eventPayload,
      recipientIds: [promotion.userId],
    });
  }

  const previousRanks = new Map(current.map((rsvp) => [rsvp.userId, rsvp.waitlistRank]));

  for (const entry of plan.reranked) {
    if (previousRanks.get(entry.userId) === entry.waitlistRank) {
      continue;
    }

    await tx.eventRsvp.update({
      where: { instanceId_userId: { instanceId: instance.id, userId: entry.userId } },
      data: { waitlistRank: entry.waitlistRank },
    });

    intents.push({
      type: "waitlist_position_changed",
      seriesId: series.id,
      instanceId: instance.id,
      actorId,
      payload: { ...eventPayload, waitlistRank: entry.waitlistRank },
      recipientIds: [entry.userId],
    });
  }

  return intents;
}

function assertRsvpAllowed(instance: EventInstance, series: EventSeries): void {
  if (instance.status === "cancelled") {
    throw new RsvpServiceError("conflict", "This occurrence has been cancelled.");
  }

  if (series.status === "cancelled") {
    throw new RsvpServiceError("conflict", "This event has been cancelled.");
  }

  if (instance.startsAt.getTime() < Date.now()) {
    throw new RsvpServiceError("conflict", "This occurrence has already started.");
  }
}

/** Translates a domain rejection into the service-level code the API returns. */
export function toServiceError(error: unknown): RsvpServiceError {
  if (error instanceof RsvpServiceError) {
    return error;
  }

  if (error instanceof RsvpError) {
    return new RsvpServiceError(
      error.code === "capacity_full" ? "capacity_full" : "invalid",
      error.message,
    );
  }

  return new RsvpServiceError("invalid", "Unable to update RSVP.");
}

export type InstanceAttendance = {
  capacity: CapacitySnapshot;
  goingCount: number;
  viewerRsvp: EventRsvp | null;
};

/** Everything the RSVP controls need to render for one occurrence. */
export async function getAttendance(
  instanceId: string,
  capacity: number | null,
  viewerId?: string | null,
): Promise<InstanceAttendance> {
  const rsvps = await prisma.eventRsvp.findMany({ where: { instanceId } });

  return {
    capacity: summarizeCapacity(
      capacity,
      rsvps.map((rsvp) => ({
        userId: rsvp.userId,
        status: rsvp.status,
        guestCount: rsvp.guestCount,
        waitlistRank: rsvp.waitlistRank,
      })),
    ),
    goingCount: rsvps.filter((rsvp) => rsvp.status === "going").length,
    viewerRsvp: viewerId ? (rsvps.find((rsvp) => rsvp.userId === viewerId) ?? null) : null,
  };
}

/** Batched version of `getAttendance` for lists of occurrences. */
export async function getAttendanceMap(
  instanceIds: string[],
  viewerId?: string | null,
): Promise<Map<string, { rsvps: EventRsvp[]; viewerRsvp: EventRsvp | null }>> {
  if (instanceIds.length === 0) {
    return new Map();
  }

  const rsvps = await prisma.eventRsvp.findMany({
    where: { instanceId: { in: instanceIds } },
  });

  const grouped = new Map<string, { rsvps: EventRsvp[]; viewerRsvp: EventRsvp | null }>();

  for (const instanceId of instanceIds) {
    grouped.set(instanceId, { rsvps: [], viewerRsvp: null });
  }

  for (const rsvp of rsvps) {
    const entry = grouped.get(rsvp.instanceId);
    if (!entry) continue;
    entry.rsvps.push(rsvp);
    if (viewerId && rsvp.userId === viewerId) {
      entry.viewerRsvp = rsvp;
    }
  }

  return grouped;
}
