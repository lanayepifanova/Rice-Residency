import Link from "next/link";
import { exploreEvents, type ExploreFilter } from "@/lib/server/feed";
import { EventGrid } from "../components/EventGrid";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

const filters: Array<{ value: ExploreFilter; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "open", label: "No capacity limit" },
];

function readFilter(value: string | string[] | undefined): ExploreFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return filters.some((filter) => filter.value === candidate)
    ? (candidate as ExploreFilter)
    : "all";
}

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const params = await searchParams;
  const filter = readFilter(params.when);
  const events = await exploreEvents(filter);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">Explore</h1>

        {params.share === "expired" ? (
          <p className="banner-danger" role="status">
            That share link has been revoked or never existed. Everything public is still below.
          </p>
        ) : null}

        <p className="field-hint">
          Every public event, soonest first. Anyone can browse this, signed in or not.
        </p>

        {/* Links rather than a JavaScript filter, so each view is a real URL
            that can be bookmarked and shared. */}
        <nav className="filter-row" aria-label="Filter events">
          {filters.map((option) => (
            <a
              key={option.value}
              href={option.value === "all" ? "/explore" : `/explore?when=${option.value}`}
              className={option.value === filter ? "filter-chip filter-chip-active" : "filter-chip"}
            >
              {option.label}
            </a>
          ))}
        </nav>

        <EventGrid
          events={events}
          empty={
            filter === "all" ? (
              <>
                Nothing public yet. <Link href="/events/new">Create an event</Link> and it appears here.
              </>
            ) : (
              <>
                Nothing matches that filter. <Link href="/explore">See everything</Link>.
              </>
            )
          }
        />
      </main>
    </>
  );
}
