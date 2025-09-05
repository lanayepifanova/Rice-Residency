/* eslint-disable @next/next/no-img-element */

import type { Person } from "@/lib/server/people";

/** What the house can say about someone who has filled nothing in themselves. */
function standing(person: Person): string {
  if (person.lead) {
    return "House Leader";
  }

  return person.membership === "resident" ? "House Resident" : "Community Member";
}

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
        {/* Where they stand in the house — whether they run it, live in it, or
            are one of the people around it. This used to lead with whatever
            they were building, which made the directory read as a list of
            projects and buried the one thing every card should agree on. The
            project is on their own page, where there is room for it. */}
        <p>{standing(person)}</p>
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
