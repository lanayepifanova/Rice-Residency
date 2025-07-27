import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { avatarInitial, displayName } from "./profile";

/**
 * Everyone affiliated with the house, and what they are building. The events
 * are the reason people come; this is how they find each other afterwards.
 */
export type Person = {
  id: string;
  name: string;
  /** Lives here, or comes to cowork. The house draws this line, so the app does. */
  membership: "resident" | "attendee";
  username: string | null;
  href: string | null;
  avatarUrl: string | null;
  initial: string;
  bio: string | null;
  riceYear: string | null;
  major: string | null;
  /** "Junior · Computer Science", or whichever half is filled in. */
  study: string | null;
  project: { name: string; summary: string | null; url: string | null } | null;
  pastProjects: string | null;
  helpNeeded: string | null;
  instagram: string | null;
  twitter: string | null;
};

function toPerson(user: User): Person {
  return {
    id: user.id,
    name: displayName(user),
    membership: user.membership,
    username: user.username,
    // A profile is addressed by handle, so someone who has not set one yet is
    // listed but has no page to link to.
    href: user.username ? `/people/${user.username}` : null,
    avatarUrl: user.avatarUrl,
    initial: avatarInitial(user),
    bio: user.bio,
    riceYear: user.riceYear,
    major: user.major,
    study: [user.riceYear, user.major].filter(Boolean).join(" · ") || null,
    project: user.projectName
      ? { name: user.projectName, summary: user.projectSummary, url: user.projectUrl }
      : null,
    pastProjects: user.pastProjects,
    helpNeeded: user.helpNeeded,
    instagram: user.instagram,
    twitter: user.twitter,
  };
}

/**
 * The directory, optionally narrowed by a search. The search covers names,
 * handles, and projects together, because "who was the person working on the
 * mapping thing" is one question, not three.
 *
 * Residents and attendees come back in one list. Splitting them is the calling
 * page's job, so a search can still say how many of each it matched.
 */
export async function listPeople(query?: string): Promise<Person[]> {
  const term = query?.trim();

  const users = await prisma.user.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { username: { contains: term, mode: "insensitive" } },
            { bio: { contains: term, mode: "insensitive" } },
            { projectName: { contains: term, mode: "insensitive" } },
            { projectSummary: { contains: term, mode: "insensitive" } },
            { pastProjects: { contains: term, mode: "insensitive" } },
            { helpNeeded: { contains: term, mode: "insensitive" } },
            { major: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return users.map(toPerson);
}

/** People who have said what they are working on, for the projects list. */
export async function listProjects(): Promise<Person[]> {
  const users = await prisma.user.findMany({
    where: { projectName: { not: null } },
    orderBy: [{ projectName: "asc" }],
  });

  return users.map(toPerson);
}

export async function getPerson(username: string): Promise<Person | null> {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });

  return user ? toPerson(user) : null;
}

/** The raw row, for pages that need more than the card shape. */
export async function getPersonRecord(username: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });
}
