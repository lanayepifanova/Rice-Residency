import { recurrencePreviewSchema } from "@/lib/api/contracts";
import { badRequest, errorResponse, readJson, requireApiUser } from "@/lib/api/http";
import { buildRecurrenceSummary } from "@/lib/domain/recurrence";
import { previewOccurrences } from "@/lib/server/series";

/**
 * Shows what a rule will produce before anything is written. Requires a session
 * because only signed-in users can host, and an open endpoint that expands
 * arbitrary recurrence rules is free CPU for anyone who finds it.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const body = await readJson(request);

  if (body === null) {
    return badRequest("Send a JSON body.");
  }

  const parsed = recurrencePreviewSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid recurrence preview request.", parsed.error);
  }

  try {
    return Response.json({
      summary: buildRecurrenceSummary(parsed.data.recurrence),
      instances: previewOccurrences(parsed.data),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
