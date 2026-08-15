import { errorResponse, requireApiUser } from "@/lib/api/http";
import { requestOrigin } from "@/lib/api/origin";
import { createShareLink, shareUrl } from "@/lib/server/share-links";

/** A link that opens one specific occurrence rather than the whole series. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/event-instances/[instanceId]/share-links">,
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { instanceId } = await context.params;

  try {
    const link = await createShareLink({ kind: "instance", instanceId }, auth.userId);

    return Response.json(
      {
        id: link.id,
        token: link.token,
        url: shareUrl(requestOrigin(request), link.token),
        createdAt: link.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
