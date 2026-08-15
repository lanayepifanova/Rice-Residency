import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { displayName } from "@/lib/server/profile";
import {
  attendedEvents,
  attendingEvents,
  hostedEvents,
  upcomingPublicEvents,
} from "@/lib/server/feed";
import { EventSection } from "./components/EventGrid";
import { SideNav } from "./components/SideNav";
import { SiteHeader } from "./components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  // A logged-out visitor still gets the public events; the personal sections
  // only exist once there is someone to personalise them for.
  const [upcoming, hosting, attended, attending] = await Promise.all([
    upcomingPublicEvents({ excludeOrganizerId: user?.id, take: 12 }),
    user ? hostedEvents(user.id) : Promise.resolve([]),
    user ? attendedEvents(user.id) : Promise.resolve([]),
    user ? attendingEvents(user.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
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

        <EventSection
          title="Upcoming events"
          events={upcoming}
          empty={
            <>
              No public events yet.{" "}
              <Link href="/events/new">Create the first one</Link>.
            </>
          }
        />

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
