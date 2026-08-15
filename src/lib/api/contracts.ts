import { z } from "zod";

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/, "Use a date and time like 2026-09-07T18:30");

/**
 * Timezone names are validated against the runtime's own database rather than a
 * hardcoded list, so the set stays correct as the IANA data is updated.
 */
const timezone = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone.");

export const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(365),
  byDay: z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])).optional(),
  byMonthDay: z.array(z.number().int().min(1).max(31)).optional(),
  bySetPosition: z.array(z.number().int().min(-5).max(5)).optional(),
  until: localDateTime.nullable().optional(),
  count: z.number().int().positive().max(1_000).nullable().optional(),
});

export const eventSeriesCreateSchema = z.object({
  title: z.string().trim().min(1, "Give your event a title.").max(120),
  description: z.string().trim().max(2_000).optional(),
  coverImage: z.string().trim().min(1).optional(),
  locationName: z.string().trim().max(160).optional(),
  locationUrl: z.string().url().optional(),
  timezone,
  startsAtLocal: localDateTime,
  durationMinutes: z.number().int().min(1).max(24 * 60),
  capacity: z.number().int().positive().max(100_000).nullable().optional(),
  inviteEmails: z.array(z.string().email()).max(200).default([]),
  waitlistEnabled: z.boolean().default(true),
  visibility: z.literal("public").default("public"),
  recurrence: recurrenceSchema,
});

export const recurrencePreviewSchema = eventSeriesCreateSchema.pick({
  timezone: true,
  startsAtLocal: true,
  durationMinutes: true,
  recurrence: true,
});

/**
 * Every edit and cancellation states which occurrences it touches. The product
 * plan makes this explicit rather than implied, because "change the time" means
 * three very different things to the people already holding a spot.
 */
export const editScopeSchema = z.enum(["this", "future", "all"]);
export type EditScope = z.infer<typeof editScopeSchema>;

const seriesEditableFields = {
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  coverImage: z.string().trim().min(1).nullable().optional(),
  locationName: z.string().trim().max(160).nullable().optional(),
  locationUrl: z.string().url().nullable().optional(),
  capacity: z.number().int().positive().max(100_000).nullable().optional(),
  waitlistEnabled: z.boolean().optional(),
  timezone: timezone.optional(),
  startsAtLocal: localDateTime.optional(),
  durationMinutes: z.number().int().min(1).max(24 * 60).optional(),
  recurrence: recurrenceSchema.optional(),
};

export const seriesUpdateSchema = z
  .object({
    ...seriesEditableFields,
    scope: z.enum(["future", "all"]).default("all"),
    /**
     * Required for `future`: the occurrence the change starts from. Everything
     * before it is left exactly as it was.
     */
    fromInstanceId: z.string().min(1).optional(),
  })
  .refine((value) => value.scope !== "future" || Boolean(value.fromInstanceId), {
    message: "fromInstanceId is required when scope is 'future'.",
    path: ["fromInstanceId"],
  })
  .refine((value) => Object.keys(value).some((key) => !["scope", "fromInstanceId"].includes(key)), {
    message: "Nothing to update.",
  });

export const instanceUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).nullable().optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    locationName: z.string().trim().max(160).nullable().optional(),
    /** Moving a single occurrence. Interpreted in the series timezone. */
    startsAtLocal: localDateTime.optional(),
    durationMinutes: z.number().int().min(1).max(24 * 60).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

export const cancelSeriesSchema = z.object({
  scope: z.enum(["future", "all"]).default("future"),
  fromInstanceId: z.string().min(1).optional(),
});

export const rsvpSchema = z.object({
  status: z.enum(["going", "maybe", "busy"]),
  guestCount: z.number().int().min(0).max(10_000).default(0),
});

export const notificationPreferencesSchema = z
  .object({
    inApp: z.boolean().optional(),
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  username: z
    .string()
    .trim()
    .min(3, "Usernames need at least 3 characters.")
    .max(30)
    .regex(/^[a-z0-9_.]+$/i, "Usernames can use letters, numbers, dots, and underscores."),
  bio: z.string().trim().max(280).optional(),
  instagram: z.string().trim().max(120).optional(),
  twitter: z.string().trim().max(120).optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 1994-08-11")
    .optional(),
});

/**
 * `from` and `to` on the instances query. Accepts a plain date (2026-09-01) or
 * a full ISO instant, since the contract shows the short form but callers
 * paginating through a calendar naturally hold timestamps.
 */
export const instanceRangeSchema = z.object({
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

export type EventSeriesCreateRequest = z.infer<typeof eventSeriesCreateSchema>;
export type SeriesUpdateRequest = z.infer<typeof seriesUpdateSchema>;
export type InstanceUpdateRequest = z.infer<typeof instanceUpdateSchema>;
export type RsvpRequest = z.infer<typeof rsvpSchema>;
export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>;
