import { instanceRangeSchema } from "@/lib/api/contracts";
import { badRequest } from "@/lib/api/http";
import { getSeries, listInstances, materializeSeries, occurrenceTitle } from "@/lib/server/series";

/**
 * `GET /event-series/{id}/instances?from=2026-09-01&to=2026-10-01`
 *
 * Materializing before reading is what makes a never-ending series answerable:
 * asking for a window past the generated horizon extends it rather than
 * returning a short list.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/event-series/[seriesId]/instances">,
) {
  const { seriesId } = await context.params;
  const series = await getSeries(seriesId);

  if (!series || series.visibility !== "public") {
    return Response.json({ error: "Event not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = instanceRangeSchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return badRequest("Invalid date range.", parsed.error);
  }

  const from = parseBoundary(parsed.data.from);
  const to = parseBoundary(parsed.data.to, true);

  if (parsed.data.from && !from) {
    return badRequest("`from` is not a valid date.");
  }
  if (parsed.data.to && !to) {
    return badRequest("`to` is not a valid date.");
  }

  await materializeSeries(seriesId);

  const instances = await listInstances(seriesId, { from: from ?? undefined, to: to ?? undefined });

  return Response.json({
    seriesId,
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    instances: instances.map((instance) => ({
      id: instance.id,
      startsAt: instance.startsAt,
      endsAt: instance.endsAt,
      localDate: instance.localDate,
      status: instance.status,
      ...occurrenceTitle(series, instance),
    })),
  });
}

/**
 * Accepts both `2026-09-01` and a full ISO instant. A bare date used as an
 * upper bound covers the whole day, so `to=2026-10-01` includes an event that
 * evening rather than cutting off at midnight.
 */
function parseBoundary(value: string | undefined, endOfDay = false): Date | null {
  if (!value) {
    return null;
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
