import { redirect } from "next/navigation";
import { nextOccurrenceHref } from "@/lib/server/series";

export const dynamic = "force-dynamic";

/**
 * There is no series page any more: an event is a date, and that is what people
 * are sent to. The route stays as a forward so share links and notifications
 * already pointing at a series still land somewhere real.
 */
export default async function SeriesPage({ params, searchParams }: PageProps<"/events/[seriesId]">) {
  const { seriesId } = await params;
  const query = await searchParams;
  const href = await nextOccurrenceHref(seriesId);

  redirect(query.created ? `${href}?created=1` : href);
}
