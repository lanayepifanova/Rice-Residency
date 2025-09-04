import Link from "next/link";
import { BUILT_AT } from "@/lib/server/built-at";
import { SCHEDULE_DATES, seriesSchedules } from "@/lib/server/feed";
import { TimedSeriesEvents } from "./components/TimedEvents";
import { SideNav } from "./components/SideNav";
import { SiteHeader } from "./components/SiteHeader";

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
            <TimedSeriesEvents
              key={section.seriesId}
              section={section}
              horizon="upcoming"
              take={SCHEDULE_DATES}
              builtAt={BUILT_AT}
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
