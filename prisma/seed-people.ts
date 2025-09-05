import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { attendees, residents, retiredDemoUsernames, usernameFor, type Person } from "./people-data";

/**
 * Imports the house directory from `people-data.ts`.
 *
 * Safe to re-run: every person is keyed on their handle, so a second run
 * updates rather than duplicates. Profile fields people have filled in
 * themselves are never touched — this owns a person's name and which list they
 * are on, nothing else.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to whatever the environment already provides.
}

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set to seed people.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function upsertPerson(person: Person, membership: "resident" | "attendee") {
  const username = usernameFor(person);

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      // Only what this file owns. Someone who has written a bio or set a photo
      // keeps it: re-running the import must not undo a person's own edits.
      data: {
        name: person.name,
        membership,
        houseLead: person.lead ?? false,
        ...(person.email ? { email: person.email } : {}),
        // The directory headshot fills an empty slot, it does not replace a
        // choice. Once someone uploads their own photo this stops touching it.
        ...(person.photo && !existing.avatarUrl ? { avatarUrl: person.photo } : {}),
        // Same rule for the words: what the public site says about someone
        // stands in until they write their own, and then it stops.
        ...(person.bio && !existing.bio ? { bio: person.bio } : {}),
        ...(person.projectName && !existing.projectName
          ? { projectName: person.projectName }
          : {}),
        ...(person.projectSummary && !existing.projectSummary
          ? { projectSummary: person.projectSummary }
          : {}),
      },
    });

    return;
  }

  await prisma.user.create({
    data: {
      name: person.name,
      username,
      membership,
      houseLead: person.lead ?? false,
      // Null rather than a placeholder: this person has no account yet.
      email: person.email ?? null,
      avatarUrl: person.photo ?? null,
      bio: person.bio ?? null,
      projectName: person.projectName ?? null,
      projectSummary: person.projectSummary ?? null,
    },
  });
}

async function main() {
  console.log("Seeding the house directory…");

  const residentUsernames = new Set(residents.map(usernameFor));
  const clashes = attendees.map(usernameFor).filter((name) => residentUsernames.has(name));

  if (clashes.length) {
    throw new Error(
      `These people are in both lists, so it is ambiguous which they are: ${clashes.join(", ")}. ` +
        "A resident who also coworks belongs in the residents list only.",
    );
  }

  const misplacedLeads = attendees.filter((person) => person.lead).map((person) => person.name);

  if (misplacedLeads.length) {
    throw new Error(
      `These people are marked as house leads but are not residents: ${misplacedLeads.join(", ")}. ` +
        "A lead lives at the house, so they belong in the residents list.",
    );
  }

  for (const person of residents) {
    await upsertPerson(person, "resident");
  }

  for (const person of attendees) {
    await upsertPerson(person, "attendee");
  }

  // The invented residents the seed used to create. Their events stay; the
  // RSVPs they left behind go with them, which is what cascade delete is for.
  const removed = await prisma.user.deleteMany({
    where: { username: { in: retiredDemoUsernames } },
  });

  console.log(`  ${residents.length} residents`);
  console.log(`  ${attendees.length} coworking attendees`);

  if (removed.count) {
    console.log(`  ${removed.count} invented demo people removed`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
