import Link from "next/link";
import { listPeople } from "@/lib/server/people";
import { PeopleGrid } from "../components/PeopleGrid";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

function readQuery(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim() : "";
}

/**
 * Explore is people, not events — the events are on the home page. This is the
 * house directory: who is around, and what they are working on.
 */
export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const params = await searchParams;
  const query = readQuery(params.q);
  const people = await listPeople(query);
  const building = people.filter((person) => person.project);

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

        {/* A plain GET form, so a search is a real URL that can be shared. */}
        <form className="people-search" action="/explore" method="get">
          <label className="field">
            <span className="field-label">Search people and projects</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="A name, a major, a project, or what someone needs help with"
            />
          </label>
          <button type="submit">Search</button>
          {query ? <Link href="/explore">Clear</Link> : null}
        </form>

        {query ? (
          <p className="field-hint">
            {people.length} {people.length === 1 ? "person" : "people"} matching “{query}”
            {building.length ? ` · ${building.length} with a project listed` : ""}.
          </p>
        ) : null}

        <PeopleGrid
          people={people}
          empty={
            query ? (
              <>
                Nobody matches “{query}”. <Link href="/explore">See everyone</Link>.
              </>
            ) : (
              <>
                Nobody has a profile yet. <Link href="/settings/profile">Set yours up</Link> and you
                appear here.
              </>
            )
          }
        />
      </main>
    </>
  );
}
