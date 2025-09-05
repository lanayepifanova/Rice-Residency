import { redirect } from "next/navigation";
import { nextOccurrenceHref } from "@/lib/server/series";
import { SideNav } from "../../components/SideNav";
import { SiteHeader } from "../../components/SiteHeader";

export const dynamic = "force-dynamic";

/**
 * There is no series page any more: an event is a date, and that is what people
 * are sent to. The route stays as a forward so share links and notifications
 * already pointing at a series still land somewhere real.
 *
 * A series with no dates on it yet has nothing to forward to. It used to bounce
 * to the home page, which read as a broken link — the Parties and Dinners
 * entries in the nav both did — so it says so instead.
 */
export default async function SeriesPage({ params, searchParams }: PageProps<"/events/[seriesId]">) {
  const { seriesId } = await params;
  const query = await searchParams;
  const href = await nextOccurrenceHref(seriesId);

  if (href === "/") {
    return (
      <>
        <SiteHeader />
        <SideNav />
        <main>
          <p className="coming-soon">coming soon...</p>
        </main>
      </>
    );
  }

  redirect(query.created ? `${href}?created=1` : href);
}
