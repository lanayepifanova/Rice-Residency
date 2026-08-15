import { errorResponse, requireApiUser } from "@/lib/api/http";
import { cancelInstance } from "@/lib/server/series";

/** Cancels one occurrence. The rest of the series carries on. */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/event-instances/[instanceId]/cancel">,
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { instanceId } = await context.params;

  try {
    const instance = await cancelInstance(instanceId, auth.userId);
    return Response.json({ instance, scope: "this" });
  } catch (error) {
    return errorResponse(error);
  }
}
