import { notificationPreferencesSchema } from "@/lib/api/contracts";
import { badRequest, errorResponse, readJson, requireApiUser } from "@/lib/api/http";
import { getPreferences, updatePreferences } from "@/lib/server/notifications";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  try {
    return Response.json({ preferences: await getPreferences(auth.userId) });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * `push` and `sms` are storable now and delivered later. Keeping the preference
 * surface complete means adding a provider is an adapter change, not a schema
 * and API change.
 */
export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const body = await readJson(request);

  if (body === null) {
    return badRequest("Send a JSON body.");
  }

  const parsed = notificationPreferencesSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid notification preferences.", parsed.error);
  }

  try {
    return Response.json({ preferences: await updatePreferences(auth.userId, parsed.data) });
  } catch (error) {
    return errorResponse(error);
  }
}
