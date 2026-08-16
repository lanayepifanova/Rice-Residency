import Link from "next/link";
import { archivedSeries } from "@/lib/server/feed";
import { SeriesEvents } from "../components/EventGrid";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

/**
 * Where dates go once they have happened. The home page only carries what is
 * still ahead, so without this everything that has already run would simply
 * disappear.
 */
export default async function ArchivePage() {
  const sections = await archivedSeries();

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">Archive</h1>

        {sections.length ? (
          sections.map((section) => (
            <SeriesEvents key={section.seriesId} section={section} empty={null} />
          ))
        ) : (
          <p className="event-empty">
            Nothing has happened yet. Once a date passes it is kept here.{" "}
            <Link href="/">See what is coming up</Link>.
          </p>
        )}
      </main>
    </>
  );
}
