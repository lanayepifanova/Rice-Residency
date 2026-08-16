import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { displayName } from "@/lib/server/profile";
import {
  attendedEvents,
  attendingEvents,
  hostedEvents,
  plannedSeries,
  seriesSchedules,
} from "@/lib/server/feed";
import { EventSection, SeriesEvents } from "./components/EventGrid";
import { SideNav } from "./components/SideNav";
import { SiteHeader } from "./components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  // A logged-out visitor still gets the public events; the personal sections
  // only exist once there is someone to personalise them for.
  const [schedules, planned, hosting, attended, attending] = await Promise.all([
    seriesSchedules(),
    plannedSeries(),
    user ? hostedEvents(user.id) : Promise.resolve([]),
    user ? attendedEvents(user.id) : Promise.resolve([]),
    user ? attendingEvents(user.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        {planned.length ? (
          <p className="banner-announcement" role="status">
            We are working on the calendar for{" "}
            {planned.map((series, index) => (
              <span key={series.id}>
                {index > 0 ? (index === planned.length - 1 ? " and " : ", ") : ""}
                <strong>{series.title}</strong>
              </span>
            ))}
            . Dates land here as soon as they are set.
          </p>
        ) : null}

        <h1 className="welcome-heading">
          {user ? `Welcome Back ${displayName(user)}` : "Find something to go to"}
        </h1>

        {user ? (
          <EventSection
            title="You are going to"
            events={attending}
            empty={<>Nothing on your calendar yet. RSVP to an event and it shows up here.</>}
          />
        ) : null}

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

        {user ? (
          <>
            <EventSection
              title="Events you are hosting"
              events={hosting}
              empty={
                <>
                  You are not hosting anything. <Link href="/events/new">Create an event</Link> to
                  get started.
                </>
              }
            />

            <EventSection
              title="Events you attended"
              events={attended}
              empty={<>Once an event you said yes to has happened, it lands here.</>}
            />
          </>
        ) : (
          <p className="event-empty">
            <Link href="/login">Sign in</Link> to RSVP, host your own events, and keep track of what you
            have been to.
          </p>
        )}
      </main>
    </>
  );
}
