import { eventSeriesCreateSchema } from "@/lib/api/contracts";
import { buildInstances, buildRecurrenceSummary } from "@/lib/domain/recurrence";
import { buildNotificationDeliveries } from "@/lib/domain/notifications";
import { demoStore } from "@/lib/domain/store";

export async function POST(request: Request) {
  const body = await readCreateSeriesBody(request);
  const parsed = eventSeriesCreateSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid event series request.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const now = Date.now();
  const seriesId = `series_${now}`;
  const organizerId = request.headers.get("x-user-id") ?? "demo_user";
  const instances = buildInstances({
    startsAtLocal: parsed.data.startsAtLocal,
    durationMinutes: parsed.data.durationMinutes,
    timezone: parsed.data.timezone,
    recurrence: parsed.data.recurrence,
    limit: 12,
    horizonYears: 10,
  }).map((instance, index) => ({
    id: `inst_${now}_${index + 1}`,
    seriesId,
    status: "scheduled" as const,
    ...instance,
  }));

  const series = {
    id: seriesId,
    organizerId,
    status: "active" as const,
    title: parsed.data.title,
    description: parsed.data.description,
    coverImage: parsed.data.coverImage,
    locationName: parsed.data.locationName,
    locationUrl: parsed.data.locationUrl,
    timezone: parsed.data.timezone,
    startsAtLocal: parsed.data.startsAtLocal,
    durationMinutes: parsed.data.durationMinutes,
    capacity: parsed.data.capacity ?? null,
    inviteEmails: parsed.data.inviteEmails,
    waitlistEnabled: parsed.data.waitlistEnabled,
    visibility: parsed.data.visibility,
    recurrence: parsed.data.recurrence,
  };

  demoStore.series.set(seriesId, series);
  for (const instance of instances) {
    demoStore.instances.set(instance.id, instance);
  }

  const notificationEvent = {
    type: "event_series_created" as const,
    seriesId,
    payload: {
      title: parsed.data.title,
      recurrence: buildRecurrenceSummary(parsed.data.recurrence),
    },
  };

  return Response.json(
    {
      series,
      instances,
      invitedEmails: parsed.data.inviteEmails,
      notificationDeliveries: buildNotificationDeliveries(notificationEvent, [
        {
          userId: organizerId,
          preferences: { in_app: true, email: false, push: false, sms: false },
        },
      ]),
    },
    { status: 201 },
  );
}

async function readCreateSeriesBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  const byDay = formData.getAll("byDay").map(String);
  const capacityValue = stringValue(formData.get("capacity"));
  const untilValue = stringValue(formData.get("until"));
  const description = stringValue(formData.get("description"));
  const coverImage = stringValue(formData.get("coverImage"));
  const locationName = stringValue(formData.get("locationName"));
  const inviteEmails = parseEmailList(stringValue(formData.get("inviteEmails")));

  return {
    title: stringValue(formData.get("title")),
    description: description || undefined,
    coverImage: coverImage || undefined,
    locationName: locationName || undefined,
    timezone: stringValue(formData.get("timezone")),
    startsAtLocal: stringValue(formData.get("startsAtLocal")),
    durationMinutes: numberValue(formData.get("durationMinutes")),
    capacity: capacityValue ? Number(capacityValue) : null,
    inviteEmails,
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    visibility: "public",
    recurrence: {
      freq: stringValue(formData.get("freq")),
      interval: numberValue(formData.get("interval")),
      byDay: byDay.length ? byDay : undefined,
      until: untilValue || null,
      count: null,
    },
  };
}

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: FormDataEntryValue | null): number {
  return Number(stringValue(value));
}

function parseEmailList(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}
