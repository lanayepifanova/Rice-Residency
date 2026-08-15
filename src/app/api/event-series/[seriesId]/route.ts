import { seriesUpdateSchema } from "@/lib/api/contracts";
import { badRequest, errorResponse, readJson, requireApiUser } from "@/lib/api/http";
import { buildRecurrenceSummary } from "@/lib/domain/recurrence";
import { getCurrentUser } from "@/lib/auth";
import {
  getSeries,
  listInstances,
  materializeSeries,
  readRecurrence,
  updateSeries,
} from "@/lib/server/series";

/**
 * Public events are readable by anyone, signed in or not — the plan makes that
 * an explicit release gate. Only the host-only fields are held back.
 */
export async function GET(_request: Request, context: RouteContext<"/api/event-series/[seriesId]">) {
  const { seriesId } = await context.params;
  const series = await getSeries(seriesId);

  if (!series || series.visibility !== "public") {
    return Response.json({ error: "Event not found." }, { status: 404 });
  }

  await materializeSeries(seriesId);

  const viewer = await getCurrentUser();
  const isOrganizer = viewer?.id === series.organizerId;
  const instances = await listInstances(seriesId, { from: new Date(), take: 25 });

  return Response.json({
    series: {
      id: series.id,
      title: series.title,
      description: series.description,
      coverImage: series.coverImage,
      locationName: series.locationName,
      locationUrl: series.locationUrl,
      timezone: series.timezone,
      startsAtLocal: series.startsAtLocal,
      durationMinutes: series.durationMinutes,
      capacity: series.capacity,
      waitlistEnabled: series.waitlistEnabled,
      visibility: series.visibility,
      status: series.status,
      recurrence: readRecurrence(series),
      recurrenceSummary: buildRecurrenceSummary(readRecurrence(series)),
      organizerId: series.organizerId,
      isOrganizer,
    },
    instances,
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/event-series/[seriesId]">,
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { seriesId } = await context.params;
  const body = await readJson(request);

  if (body === null) {
    return badRequest("Send a JSON body.");
  }

  const parsed = seriesUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid event update.", parsed.error);
  }

  try {
    const result = await updateSeries(seriesId, auth.userId, parsed.data);

    return Response.json({
      series: result.series,
      // Present only for a `future`-scoped edit, which splits the series so
      // past occurrences keep the values they were published with.
      splitSeriesId: result.splitSeriesId ?? null,
      scope: parsed.data.scope,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
