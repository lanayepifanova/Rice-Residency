/* eslint-disable @next/next/no-img-element */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatDay } from "@/lib/domain/format";
import { attendedEvents, hostedEvents } from "@/lib/server/feed";
import { getPerson, getPersonRecord } from "@/lib/server/people";
import { EventSection } from "../../components/EventGrid";
import { SideNav } from "../../components/SideNav";
import { SiteHeader } from "../../components/SiteHeader";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/people/[username]">): Promise<Metadata> {
  const { username } = await params;
  const person = await getPerson(username);

  if (!person) {
    return { title: "Person not found" };
  }

  return {
    title: `${person.name} · Rice Residency`,
    description: person.project
      ? `${person.project.name}${person.project.summary ? ` — ${person.project.summary}` : ""}`
      : (person.bio ?? undefined),
  };
}

/**
 * Someone else's profile. Public on purpose: the point of the directory is
 * being able to look someone up after meeting them at the house.
 */
export default async function PersonPage({ params }: PageProps<"/people/[username]">) {
  const { username } = await params;
  const record = await getPersonRecord(username);

  if (!record) {
    notFound();
  }

  const person = (await getPerson(username))!;

  const [hosting, attended] = await Promise.all([
    hostedEvents(record.id, 6),
    attendedEvents(record.id, 6),
  ]);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <section className="profile-header">
          {person.avatarUrl ? (
            <img className="profile-photo-large" src={person.avatarUrl} alt="" />
          ) : (
            <span className="profile-photo-large" aria-hidden="true">
              {person.initial}
            </span>
          )}

          <div>
            <h1 className="welcome-heading">{person.name}</h1>
            <p className="event-meta">
              {person.username ? `@${person.username}` : null}
              {person.username && person.study ? " · " : null}
              {person.study}
            </p>
            {person.bio ? <p>{person.bio}</p> : null}

            <p className="field-hint">
              Around since{" "}
              {formatDay(record.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}.
            </p>

            <p className="profile-socials">
              {person.instagram ? (
                <a href={`https://instagram.com/${person.instagram.replace(/^@/, "")}`}>Instagram</a>
              ) : null}
              {person.twitter ? (
                <a href={`https://x.com/${person.twitter.replace(/^@/, "")}`}>Twitter</a>
              ) : null}
            </p>
          </div>
        </section>

        <dl className="person-facts">
          {person.project ? (
            <div className="person-fact">
              <dt>Working on</dt>
              <dd>
                {person.project.url ? (
                  <a href={person.project.url}>{person.project.name}</a>
                ) : (
                  person.project.name
                )}
                {person.project.summary ? (
                  <span className="person-fact-note">{person.project.summary}</span>
                ) : null}
              </dd>
            </div>
          ) : null}

          {person.pastProjects ? (
            <div className="person-fact">
              <dt>Past projects</dt>
              <dd>{person.pastProjects}</dd>
            </div>
          ) : null}

          {person.helpNeeded ? (
            <div className="person-fact">
              <dt>Needs help with</dt>
              <dd>{person.helpNeeded}</dd>
            </div>
          ) : null}
        </dl>

        <EventSection
          title="Hosting"
          events={hosting}
          empty={<>Not hosting anything right now.</>}
        />

        <EventSection
          title="Events they have been to"
          events={attended}
          empty={<>Nothing yet.</>}
        />
      </main>
    </>
  );
}
