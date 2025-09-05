import { archivedSeries } from "@/lib/server/feed";
import { SeriesEvents } from "../components/EventGrid";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

/**
 * Where dates go once they have happened. The home page only carries what is
 * still ahead, so without this everything that has already run would simply
 * disappear.
 *
 * Nothing has reached it yet — the first date the archive keeps has not passed
 * — so while it is empty the page says only that, rather than explaining an
 * archive that has nothing in it to explain.
 */
export default async function ArchivePage() {
  const sections = await archivedSeries();

  if (sections.length === 0) {
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

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">Archive</h1>

        {sections.map((section) => (
          <SeriesEvents key={section.seriesId} section={section} empty={null} />
        ))}
      </main>
    </>
  );
}
