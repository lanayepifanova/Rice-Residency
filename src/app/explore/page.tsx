import Link from "next/link";
import { listPeople } from "@/lib/server/people";
import { PeopleGrid } from "../components/PeopleGrid";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

/**
 * Explore is people, not events — the events are on the home page. This is the
 * house directory: who lives here, who comes to cowork, and what they are all
 * working on.
 */
export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const params = await searchParams;
  const people = await listPeople();
  const leads = people.filter((person) => person.lead);
  // Leads are residents too, but listing them twice would read as two different
  // people, so the residents list is everyone else who lives here.
  const residents = people.filter((person) => person.membership === "resident" && !person.lead);
  const attendees = people.filter((person) => person.membership === "attendee");

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">People</h1>

        {params.share === "expired" ? (
          <p className="banner-danger" role="status">
            That share link has been revoked or never existed.
          </p>
        ) : null}

        {/* Three lists, because the house draws these lines and conflating them
            loses the distinctions that matter: who runs it, and who lives in
            it. Leads come first — they are who you ask. */}
        <section className="event-section">
          <div className="event-section-head">
            <h2>House Leaders</h2>
            <span className="event-section-note">
              {leads.length} {leads.length === 1 ? "person" : "people"}
            </span>
          </div>
          <PeopleGrid people={leads} empty={<>No house leaders listed yet.</>} />
        </section>

        <section className="event-section">
          <div className="event-section-head">
            <h2>Residents</h2>
            <span className="event-section-note">
              {residents.length} {residents.length === 1 ? "person" : "people"}
            </span>
          </div>
          <PeopleGrid
            people={residents}
            empty={
              <>
                No residents listed yet. <Link href="/settings/profile">Set up your profile</Link>{" "}
                and you appear here.
              </>
            }
          />
        </section>

        <section className="event-section">
          <div className="event-section-head">
            <h2>Coworking</h2>
            <span className="event-section-note">
              {attendees.length} {attendees.length === 1 ? "person" : "people"}
            </span>
          </div>
          <PeopleGrid
            people={attendees}
            empty={<>Nobody from the coworking sessions is listed yet.</>}
          />
        </section>
      </main>
    </>
  );
}
