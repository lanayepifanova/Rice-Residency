import { eventSeriesCreateSchema } from "@/lib/api/contracts";
import { badRequest, errorResponse, readJson, requireApiUser } from "@/lib/api/http";
import { buildRecurrenceSummary } from "@/lib/domain/recurrence";
import { createSeries } from "@/lib/server/series";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const body = await readJson(request);

  if (body === null) {
    return badRequest("Send a JSON body.");
  }

  const parsed = eventSeriesCreateSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid event series request.", parsed.error);
  }

  try {
    const series = await createSeries(auth.userId, parsed.data);

    return Response.json(
      {
        series: {
          ...series,
          recurrenceSummary: buildRecurrenceSummary(parsed.data.recurrence),
        },
        instances: series.instances,
        invitedEmails: parsed.data.inviteEmails,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
