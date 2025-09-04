import { notFound } from "next/navigation";
import { seriesDates, publicSeriesIds } from "@/lib/server/feed";
import { SeriesForward } from "./SeriesForward";
import { SideNav } from "../../components/SideNav";
import { SiteHeader } from "../../components/SiteHeader";

/**
 * There is no series page any more: an event is a date, and that is what people
 * are sent to. The route stays as a forward so share links and nav entries
 * already pointing at a series still land somewhere real.
 *
 * A series with no dates on it yet has nothing to forward to. It used to bounce
 * to the home page, which read as a broken link — the Parties and Dinners
 * entries in the nav both did — so it says so instead. A series id that matches
 * nothing at all is a different answer: "coming soon" would be a promise about
 * an event nobody is planning, so that one is a 404. With the site prerendered
 * that 404 is simply the page never being built.
 */
export async function generateStaticParams() {
  const ids = await publicSeriesIds();

  return ids.map((seriesId) => ({ seriesId }));
}

export default async function SeriesPage({ params }: PageProps<"/events/[seriesId]">) {
  const { seriesId } = await params;
  const dates = await seriesDates(seriesId);

  if (!dates) {
    notFound();
  }

  if (dates.length === 0) {
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

  return <SeriesForward dates={dates} />;
}
