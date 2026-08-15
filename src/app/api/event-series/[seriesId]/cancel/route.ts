import { cancelSeriesSchema } from "@/lib/api/contracts";
import { badRequest, errorResponse, readJson, requireApiUser } from "@/lib/api/http";
import { cancelSeries } from "@/lib/server/series";

/**
 * Cancelling states its scope. `future` stops the event from here on and leaves
 * occurrences that already happened as the record they are; `all` marks the
 * entire history cancelled too.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/event-series/[seriesId]/cancel">,
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { seriesId } = await context.params;
  const body = await readJson(request);

  if (body === null) {
    return badRequest("Send a JSON body.");
  }

  const parsed = cancelSeriesSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid cancellation request.", parsed.error);
  }

  try {
    const series = await cancelSeries(seriesId, auth.userId, {
      scope: parsed.data.scope,
      fromInstanceId: parsed.data.fromInstanceId,
    });

    return Response.json({ series, scope: parsed.data.scope });
  } catch (error) {
    return errorResponse(error);
  }
}
