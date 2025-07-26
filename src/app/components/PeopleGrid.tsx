/* eslint-disable @next/next/no-img-element */

import type { Person } from "@/lib/server/people";

/**
 * People are laid out exactly like events: a square you can scan, a caption bar
 * with the two things worth reading at a glance — who they are, and what they
 * are building. Everything else is a click away on their page.
 */
function PersonSquare({ person }: { person: Person }) {
  const body = (
    <>
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" />
      ) : (
        // No photo: the initial fills the square, so a directory of people who
        // never uploaded one still reads as a grid rather than a list of gaps.
        <span className="person-monogram" aria-hidden="true">
          {person.initial}
        </span>
      )}

      <span className="event-square-text">
        <h3>{person.name}</h3>
        {/* What they are building, else where they are in school, else the only
            thing the house actually knows about them. "At the house" would be a
            plain untruth on someone who does not live here, so they are named
            for the thing that is true: they are part of the community. */}
        <p>
          {person.project
            ? person.project.name
            : (person.study ??
              (person.membership === "resident" ? "At the house" : "Community Member"))}
        </p>
      </span>
    </>
  );

  return person.href ? (
    <a className="event-square person-square" href={person.href}>
      {body}
    </a>
  ) : (
    <div className="event-square person-square">{body}</div>
  );
}

export function PeopleGrid({ people, empty }: { people: Person[]; empty: React.ReactNode }) {
  if (people.length === 0) {
    return <p className="event-empty">{empty}</p>;
  }

  return (
    <div className="event-grid">
      {people.map((person) => (
        <PersonSquare key={person.id} person={person} />
      ))}
    </div>
  );
}
