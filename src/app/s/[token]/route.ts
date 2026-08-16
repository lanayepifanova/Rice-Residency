import { NextResponse, type NextRequest } from "next/server";
import { nextOccurrenceHref } from "@/lib/server/series";
import { resolveShareLink } from "@/lib/server/share-links";

/**
 * Share link landing. Records the open, then forwards to the ordinary public
 * page — an instance link lands on that occurrence, a series link on its next
 * date.
 *
 * The redirect matters: it keeps the token out of the address bar afterwards,
 * so a shared screenshot or a copied URL from the visited page does not pass
 * the token along by accident.
 */
export async function GET(request: NextRequest, context: RouteContext<"/s/[token]">) {
  const { token } = await context.params;
  const resolved = await resolveShareLink(token);

  if (!resolved) {
    return NextResponse.redirect(new URL("/explore?share=expired", request.url));
  }

  const destination = resolved.instance
    ? `/events/${resolved.series.id}/${resolved.instance.id}`
    : await nextOccurrenceHref(resolved.series.id);

  return NextResponse.redirect(new URL(destination, request.url));
}
