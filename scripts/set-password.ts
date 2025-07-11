/**
 * Sets one account's password.
 *
 * The seeded accounts all share the password in the README, which is fine while
 * the app only listens on localhost and stops being fine the moment it has a
 * public URL: the README is in the repository, so anyone who can read it could
 * sign in as an organizer and edit the calendar. Changing the passwords that
 * matter is the fix, and this is the shortest path to it.
 *
 *   npm run db:set-password -- lana@example.com
 *   npm run db:set-password -- lana@example.com --live
 *
 * With --live the change is made on the deployed database (LIVE_DATABASE_URL)
 * instead of this machine's. Note that `npm run db:push-live` overwrites the
 * live database wholesale, so a password set there is lost on the next push --
 * set it locally too, or set it locally first and push.
 */
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/server/password";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to whatever the environment already provides.
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const live = args.includes("--live");
const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

if (!email) {
  fail("Which account? e.g. npm run db:set-password -- lana@example.com");
}

const connectionString = live
  ? process.env.LIVE_DATABASE_URL
  : (process.env.DATABASE_URL ?? process.env.DIRECT_URL);

if (!connectionString) {
  fail(
    live
      ? "LIVE_DATABASE_URL is not set. Copy it from the Vercel dashboard into .env.local."
      : "DATABASE_URL is not set. See .env.local.",
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });

    if (!user) {
      fail(`No account with the email ${email} in the ${live ? "live" : "local"} database.`);
    }

    console.log(`Setting the password for ${user.name ?? email} (${live ? "live" : "local"} database).`);

    // Typed in the clear. This is a terminal on the owner's own machine, and
    // hiding the echo would need raw-mode handling that is not worth the code.
    const password = (await rl.question("New password: ")).trim();

    if (password.length < MIN_PASSWORD_LENGTH) {
      fail(`Too short — passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });

    // Existing sessions keep working; changing a password is not the same as
    // revoking the browsers already signed in. Delete rows from "Session" to do
    // that as well.
    console.log("\nDone.");
  } finally {
    rl.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
