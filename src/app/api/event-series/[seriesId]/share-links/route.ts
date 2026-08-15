import { errorResponse, requireApiUser } from "@/lib/api/http";
import { createShareLink, listShareLinks, shareUrl } from "@/lib/server/share-links";
import { requestOrigin } from "@/lib/api/origin";

export async function POST(
  request: Request,
  context: RouteContext<"/api/event-series/[seriesId]/share-links">,
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { seriesId } = await context.params;

  try {
    const link = await createShareLink({ kind: "series", seriesId }, auth.userId);

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

export async function GET(
  request: Request,
  context: RouteContext<"/api/event-series/[seriesId]/share-links">,
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { seriesId } = await context.params;

  try {
    const links = await listShareLinks(seriesId, auth.userId);
    const origin = requestOrigin(request);

    return Response.json({
      links: links.map((link) => ({
        id: link.id,
        token: link.token,
        url: shareUrl(origin, link.token),
        instanceId: link.instanceId,
        openCount: link.openCount,
        lastOpenedAt: link.lastOpenedAt,
        createdAt: link.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
