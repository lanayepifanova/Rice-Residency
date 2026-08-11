export type NotificationChannel = "in_app" | "email" | "push" | "sms";

export type NotificationEventType =
  | "event_series_created"
  | "share_opened"
  | "rsvp_changed"
  | "capacity_reached"
  | "waitlist_position_changed"
  | "waitlist_promoted"
  | "instance_reminder"
  | "instance_changed"
  | "instance_cancelled"
  | "series_cancelled";

export type NotificationEventInput = {
  type: NotificationEventType;
  seriesId?: string;
  instanceId?: string;
  actorId?: string;
  payload: Record<string, string | number | boolean | null>;
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
