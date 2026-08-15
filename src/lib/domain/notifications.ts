export type NotificationChannel = "in_app" | "email" | "push" | "sms";

export type NotificationEventType =
  | "event_series_created"
  | "user_invited"
  | "share_opened"
  | "rsvp_changed"
  | "capacity_reached"
  | "waitlist_position_changed"
  | "waitlist_promoted"
  | "instance_reminder"
  | "instance_changed"
  | "instance_cancelled"
  | "series_cancelled";

export type NotificationPayload = Record<string, string | number | boolean | null>;

export type NotificationEventInput = {
  type: NotificationEventType;
  seriesId?: string;
  instanceId?: string;
  actorId?: string;
  payload: NotificationPayload;
};

export type NotificationDeliveryDraft = {
  userId: string;
  channel: NotificationChannel;
  event: NotificationEventInput;
};

export type NotificationPreferences = {
  in_app: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  in_app: true,
  email: false,
  push: false,
  sms: false,
};

/**
 * Channels are worked out from stored preferences alone, so adding push or SMS
 * later means adding an adapter that consumes these drafts — no change to the
 * code that decides who hears about what.
 */
export function buildNotificationDeliveries(
  event: NotificationEventInput,
  recipients: Array<{ userId: string; preferences: NotificationPreferences }>,
): NotificationDeliveryDraft[] {
  return recipients.flatMap((recipient) =>
    (Object.entries(recipient.preferences) as Array<[NotificationChannel, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([channel]) => ({
        userId: recipient.userId,
        channel,
        event,
      })),
  );
}

export type RenderedNotification = {
  title: string;
  body: string;
};

/**
 * Message text for every channel.
 *
 * Only fields the recipient is already entitled to see are read from the
 * payload — event titles, occurrence dates, counts, and the recipient's own
 * status. Never another attendee's name, email, or RSVP: message bodies travel
 * through email and push providers, and a release gate requires that they
 * carry nothing beyond public event data.
 */
export function renderNotification(
  type: NotificationEventType,
  payload: NotificationPayload,
): RenderedNotification {
  const title = text(payload.title) ?? "your event";
  const when = text(payload.when);
  const occurrence = when ? `${title} on ${when}` : title;

  switch (type) {
    case "event_series_created":
      return {
        title: "Event created",
        body: `${title} is live. ${text(payload.recurrence) ?? ""}`.trim(),
      };
    case "user_invited":
      return { title: "You were invited", body: `You have been invited to ${occurrence}.` };
    case "share_opened":
      return { title: "Share link opened", body: `Someone opened your share link for ${title}.` };
    case "rsvp_changed":
      return {
        title: "RSVP updated",
        body: `Your RSVP for ${occurrence} is now ${statusLabel(text(payload.status))}.`,
      };
    case "capacity_reached":
      return { title: "Event is full", body: `${occurrence} has reached capacity.` };
    case "waitlist_position_changed":
      return {
        title: "Waitlist moved",
        body: `You are now number ${number(payload.waitlistRank) ?? 1} on the waitlist for ${occurrence}.`,
      };
    case "waitlist_promoted":
      return {
        title: "You are off the waitlist",
        body: `A spot opened up and you are going to ${occurrence}.`,
      };
    case "instance_reminder":
      return { title: "Coming up", body: `${occurrence} starts soon.` };
    case "instance_changed":
      return { title: "Occurrence updated", body: `${occurrence} has been updated by the host.` };
    case "instance_cancelled":
      return { title: "Occurrence cancelled", body: `${occurrence} has been cancelled.` };
    case "series_cancelled":
      return { title: "Event cancelled", body: `${title} has been cancelled by the host.` };
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "going":
      return "going";
    case "maybe":
      return "maybe";
    case "busy":
      return "busy";
    case "waitlisted":
      return "waitlisted";
    default:
      return "updated";
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
