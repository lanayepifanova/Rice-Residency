import { BUILT_AT } from "@/lib/server/built-at";
import { archivedSeries } from "@/lib/server/feed";
import { TimedArchive } from "../components/TimedEvents";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

/**
 * Where dates go once they have happened. The home page only carries what is
 * still ahead, so without this everything that has already run would simply
 * disappear.
 *
 * Which dates those are is decided in the browser, not here — this page is
 * built once and read for weeks, and the boundary it draws moves every day. So
 * the whole archived run is sent down and `TimedArchive` keeps the part of it
 * that is behind the reader. That is also what decides whether there is a page
 * to show at all: until the first archived date has passed there is nothing in
 * it, and it says so rather than explaining an empty archive.
 */
export default async function ArchivePage() {
  const sections = await archivedSeries();

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <TimedArchive
          sections={sections}
          take={24}
          builtAt={BUILT_AT}
          fallback={<p className="coming-soon">coming soon...</p>}
        />
      </main>
    </>
  );
}
