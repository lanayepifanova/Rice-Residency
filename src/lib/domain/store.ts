import type { EventInstancePreview, RecurrenceRuleInput } from "./recurrence";

export type StoredEventSeries = {
  id: string;
  organizerId: string;
  title: string;
  description?: string;
  coverImage?: string;
  locationName?: string;
  locationUrl?: string;
  timezone: string;
  startsAtLocal: string;
  durationMinutes: number;
  capacity: number | null;
  inviteEmails: string[];
  waitlistEnabled: boolean;
  visibility: "public";
  recurrence: RecurrenceRuleInput;
  status: "active" | "cancelled";
};

export type StoredEventInstance = EventInstancePreview & {
  id: string;
  seriesId: string;
  status: "scheduled" | "cancelled" | "moved";
};

export type StoredEventRsvp = {
  instanceId: string;
  userId: string;
  status: "going" | "maybe" | "busy" | "waitlisted";
  guestCount: number;
  waitlistRank: number | null;
};

type DemoStore = {
  series: Map<string, StoredEventSeries>;
  instances: Map<string, StoredEventInstance>;
  rsvps: Map<string, StoredEventRsvp>;
};

const globalStore = globalThis as typeof globalThis & { mataneDemoStore?: DemoStore };

export const demoStore: DemoStore =
  globalStore.mataneDemoStore ??
  (globalStore.mataneDemoStore = {
    series: new Map(),
    instances: new Map(),
    rsvps: new Map(),
  });

export function rsvpKey(instanceId: string, userId: string): string {
  return `${instanceId}:${userId}`;
}
