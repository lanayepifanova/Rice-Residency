/**
 * Copies the database on this machine up to the deployed one.
 *
 * The house data lives in Postgres on a laptop, and a Vercel deployment cannot
 * reach a laptop -- so "the live site shows what I see locally" has to be an
 * act, not a configuration. This is that act: dump here, load there, in one
 * command that can be run again whenever the local database moves ahead.
 *
 *   npm run db:push-live                        # uses LIVE_DATABASE_URL
 *   npm run db:push-live -- postgres://...      # or an explicit target
 *
 * The dump is taken with `--clean --if-exists`, so the live database is
 * replaced rather than merged into: anything typed on the live site since the
 * last push is overwritten. That is the intended direction. This machine is the
 * copy of record, and the deployed site is a window onto it.
 */
import { spawn } from "node:child_process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine: the URLs can come from the real environment instead.
}

const source = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const target = process.argv[2] ?? process.env.LIVE_DATABASE_URL;

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!source) {
  fail("No local database. Set DATABASE_URL in .env.local.");
}

if (!target) {
  fail(
    [
      "No live database to push to. Either:",
      "",
      "  npm run db:push-live -- 'postgres://...'",
      "",
      "or put the connection string in .env.local as LIVE_DATABASE_URL.",
      "Copy it from the Vercel dashboard: Storage -> your database -> .env.local tab.",
    ].join("\n"),
  );
}

if (target === source) {
  fail("The target is the local database. That would dump it onto itself.");
}

console.log("Dumping the local database...");

// Schema and data together, so a brand new live database needs no separate
// migration step. Ownership and grants are dropped: the roles they name are
// this machine's, and the hosting provider has its own.
const dump = spawn(
  "pg_dump",
  [source, "--no-owner", "--no-privileges", "--clean", "--if-exists", "--quote-all-identifiers"],
  { stdio: ["ignore", "pipe", "inherit"] },
);

// ON_ERROR_STOP is deliberately off. A first push into an empty database runs
// the `DROP ... IF EXISTS` half of the dump against objects that were never
// there, and a handful of harmless notices is not a reason to abort.
const load = spawn("psql", ["--quiet", "--dbname", target], {
  stdio: ["pipe", "inherit", "inherit"],
});

dump.stdout?.pipe(load.stdin!);

dump.on("error", () => fail("Could not run pg_dump. Is postgresql@14 installed and on your PATH?"));
load.on("error", () => fail("Could not run psql. Is postgresql@14 installed and on your PATH?"));

load.on("close", (code) => {
  if (code !== 0) {
    fail(`psql exited with code ${code}. The live database may be half-loaded; fix the error and run this again.`);
  }

  console.log("\nDone. The live site is now showing this machine's data.");
  console.log("Redeploying is not needed — the site reads the database on every request.");
});
