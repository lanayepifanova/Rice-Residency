import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildNotificationDeliveries,
  defaultNotificationPreferences,
  renderNotification,
  type NotificationEventType,
  type NotificationPayload,
  type NotificationPreferences,
} from "@/lib/domain/notifications";

/**
 * A notification that should be recorded once the surrounding work has
 * committed. Services return these instead of writing them inline: a failure
 * to notify must never roll back the RSVP or cancellation that caused it.
 */
export type NotificationIntent = {
  type: NotificationEventType;
  seriesId?: string | null;
  instanceId?: string | null;
  actorId?: string | null;
  /**
   * Stable identity for events that must only fire once, e.g.
   * `capacity_reached:<instanceId>`. Backed by a unique index, so concurrent
   * writers cannot both win.
   */
  dedupeKey?: string | null;
  payload: NotificationPayload;
  recipientIds: string[];
};

/**
 * Writes notification events and their per-channel deliveries.
 *
 * In-app deliveries are complete the moment the row exists — the inbox reads
 * them straight from the database — so they are marked sent. Email, push, and
 * SMS rows are left pending: they are the queue a channel adapter drains, and
 * building those adapters is post-MVP without changing anything here.
 */
export async function recordNotifications(intents: NotificationIntent[]): Promise<void> {
  const meaningful = intents.filter((intent) => intent.recipientIds.length > 0);

  if (meaningful.length === 0) {
    return;
  }

  try {
    const recipientIds = [...new Set(meaningful.flatMap((intent) => intent.recipientIds))];
    const preferences = await loadPreferences(recipientIds);

    for (const intent of meaningful) {
      await recordOne(intent, preferences);
    }
  } catch (error) {
    // Notifications are a side effect of work that already succeeded. Losing
    // one is worth far less than failing the request that triggered it.
    console.error("Failed to record notifications", error);
  }
}

async function recordOne(
  intent: NotificationIntent,
  preferences: Map<string, NotificationPreferences>,
): Promise<void> {
  let eventId: string;

  try {
    const event = await prisma.notificationEvent.create({
      data: {
        type: intent.type,
        seriesId: intent.seriesId ?? null,
        instanceId: intent.instanceId ?? null,
        actorId: intent.actorId ?? null,
        dedupeKey: intent.dedupeKey ?? null,
        payload: intent.payload,
      },
      select: { id: true },
    });
    eventId = event.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Already recorded by another writer. That is the dedupe gate working.
      return;
    }
    throw error;
  }

  const drafts = buildNotificationDeliveries(
    { type: intent.type, payload: intent.payload },
    [...new Set(intent.recipientIds)].map((userId) => ({
      userId,
      preferences: preferences.get(userId) ?? defaultNotificationPreferences,
    })),
  );

  if (drafts.length === 0) {
    return;
  }

  await prisma.notificationDelivery.createMany({
    data: drafts.map((draft) => ({
      notificationEventId: eventId,
      userId: draft.userId,
      channel: draft.channel,
      status: draft.channel === "in_app" ? ("sent" as const) : ("pending" as const),
      sentAt: draft.channel === "in_app" ? new Date() : null,
    })),
    skipDuplicates: true,
  });
}

async function loadPreferences(userIds: string[]): Promise<Map<string, NotificationPreferences>> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
  });

  return new Map(
    rows.map((row) => [
      row.userId,
      { in_app: row.inApp, email: row.email, push: row.push, sms: row.sms },
    ]),
  );
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ---------------------------------------------------------------------------
// In-app inbox
// ---------------------------------------------------------------------------

export type InboxItem = {
  deliveryId: string;
  type: NotificationEventType;
  title: string;
  body: string;
  href: string | null;
  createdAt: Date;
  readAt: Date | null;
};

/**
 * The in-app channel is the only one that reads deliveries back out. Email,
 * push, and SMS rows are drained by their own adapters, so they are filtered
 * out here rather than rendered as if they had arrived in the app.
 */
export async function listInbox(userId: string, take = 50): Promise<InboxItem[]> {
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { userId, channel: "in_app" },
    include: { notificationEvent: true },
    orderBy: { createdAt: "desc" },
    take,
  });

  return deliveries.map((delivery) => {
    const event = delivery.notificationEvent;
    const payload = (event.payload ?? {}) as NotificationPayload;
    const rendered = renderNotification(event.type, payload);

    return {
      deliveryId: delivery.id,
      type: event.type,
      title: rendered.title,
      body: rendered.body,
      href: event.seriesId
        ? event.instanceId
          ? `/events/${event.seriesId}/${event.instanceId}`
          : `/events/${event.seriesId}`
        : null,
      createdAt: delivery.createdAt,
      readAt: delivery.readAt,
    };
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notificationDelivery.count({
    where: { userId, channel: "in_app", readAt: null },
  });
}

export async function markInboxRead(userId: string): Promise<number> {
  const result = await prisma.notificationDelivery.updateMany({
    where: { userId, channel: "in_app", readAt: null },
    data: { readAt: new Date() },
  });

  return result.count;
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export type StoredPreferences = {
  inApp: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
};

export async function getPreferences(userId: string): Promise<StoredPreferences> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });

  return {
    inApp: row?.inApp ?? true,
    email: row?.email ?? false,
    push: row?.push ?? false,
    sms: row?.sms ?? false,
  };
}

/**
 * Push and SMS can be stored and toggled today even though no adapter delivers
 * them yet. Preferences are the contract between the domain and the channels;
 * shipping them now means adding a provider later touches no domain code.
 */
export async function updatePreferences(
  userId: string,
  patch: Partial<StoredPreferences>,
): Promise<StoredPreferences> {
  const current = await getPreferences(userId);
  const next = { ...current, ...patch };

  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...next },
    update: next,
  });

  return next;
}
