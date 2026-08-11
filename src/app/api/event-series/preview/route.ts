import { recurrencePreviewSchema } from "@/lib/api/contracts";
import { buildInstances, buildRecurrenceSummary } from "@/lib/domain/recurrence";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = recurrencePreviewSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid recurrence preview request.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const instances = buildInstances({
    ...parsed.data,
    limit: 12,
    horizonYears: 10,
  });

  return Response.json({
    summary: buildRecurrenceSummary(parsed.data.recurrence),
    instances,
  });
}
