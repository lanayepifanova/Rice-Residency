import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { displayName } from "@/lib/server/profile";
import { seriesSchedules } from "@/lib/server/feed";
import { SeriesEvents } from "./components/EventGrid";
import { SideNav } from "./components/SideNav";
import { SiteHeader } from "./components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  const schedules = await seriesSchedules();

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">
          {user ? `Welcome Back ${displayName(user)}` : "Find something to go to"}
        </h1>

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
          <p className="event-empty">
            No public events yet. <Link href="/events/new">Create the first one</Link>.
          </p>
        )}

        {user ? null : (
          <p className="event-empty">
            <Link href="/login">Sign in</Link> to RSVP, host your own events, and keep track of what you
            have been to.
          </p>
        )}
      </main>
    </>
  );
}
