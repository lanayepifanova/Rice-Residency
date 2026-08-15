import { instanceUpdateSchema } from "@/lib/api/contracts";
import { badRequest, errorResponse, readJson, requireApiUser } from "@/lib/api/http";
import { updateInstance } from "@/lib/server/series";

/**
 * Edits a single occurrence. This is the "this occurrence only" scope: the
 * values land as overrides on the instance, so the series keeps its own and
 * every other occurrence is untouched.
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/event-instances/[instanceId]">,
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { instanceId } = await context.params;
  const body = await readJson(request);

  if (body === null) {
    return badRequest("Send a JSON body.");
  }

  const parsed = instanceUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid occurrence update.", parsed.error);
  }

  try {
    const instance = await updateInstance(instanceId, auth.userId, parsed.data);
    return Response.json({ instance, scope: "this" });
  } catch (error) {
    return errorResponse(error);
  }
}
