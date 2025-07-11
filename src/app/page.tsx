import Link from "next/link";
import { seriesSchedules } from "@/lib/server/feed";
import { SeriesEvents } from "./components/EventGrid";
import { SideNav } from "./components/SideNav";
import { SiteHeader } from "./components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schedules = await seriesSchedules();

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">Find something to go to</h1>

        {schedules.length ? (
          schedules.map((section) => (
            <SeriesEvents
              key={section.seriesId}
              section={section}
              empty={
                <>
                  No dates scheduled ahead. <Link href="/archive">See past dates</Link>.
                </>
              }
            />
          ))
        ) : (
          <p className="event-empty">No events scheduled yet.</p>
        )}
      </main>
    </>
  );
}
