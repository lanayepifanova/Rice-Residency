import { z } from "zod";

export const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1),
  byDay: z.array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"])).optional(),
  byMonthDay: z.array(z.number().int().min(1).max(31)).optional(),
  bySetPosition: z.array(z.number().int().min(-5).max(5)).optional(),
  until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)
    .nullable()
    .optional(),
  count: z.number().int().positive().nullable().optional(),
});

export const eventSeriesCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).optional(),
  locationName: z.string().trim().max(160).optional(),
  locationUrl: z.string().url().optional(),
  timezone: z.string().trim().min(1),
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/),
  durationMinutes: z.number().int().min(1).max(24 * 60),
  capacity: z.number().int().positive().nullable().optional(),
  inviteEmails: z.array(z.string().email()).default([]),
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

export const rsvpSchema = z.object({
  status: z.enum(["going", "maybe", "busy"]),
  guestCount: z.number().int().min(0),
});

export type EventSeriesCreateRequest = z.infer<typeof eventSeriesCreateSchema>;
export type RsvpRequest = z.infer<typeof rsvpSchema>;
