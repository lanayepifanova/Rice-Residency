# Putting this on the internet

The goal: a URL that anyone in the house can open and read — the calendar, the
event pages, the directory, the card-game standings — with no account, on their
phone.

## The one thing that has to change

The app reads Postgres on every request. On this laptop that database is
`localhost:5432`, and *localhost means "the machine asking"* — so a server in
Vercel's datacenter that connects to `localhost:5432` reaches its own empty
container, not this Mac. There is no setting that makes it reach here. A
deployed site needs a database that also lives on the internet.

That does not mean giving up the local database. The arrangement below keeps
this machine as the copy of record and treats the hosted one as a mirror:

```
  this laptop                              the internet
  ┌────────────────────┐                   ┌────────────────────┐
  │ Postgres 14        │  npm run          │ Postgres (Neon)    │
  │ rice_residency     │  db:push-live ──> │ same tables,       │
  │                    │                   │ same rows          │
  │ npm run dev        │                   │         ▲          │
  └────────────────────┘                   │         │ reads    │
                                           │ ┌───────┴────────┐ │
  git push ─────────────────────────────>  │ │ Vercel         │ │
                                           │ │ the site       │ │
                                           │ └────────────────┘ │
                                           └────────────────────┘
```

Edit the house data locally the way you already do, then run one command to push
it live. Nothing about local development changes.

## Once, to set it up

**1. Push the code to GitHub.**

```bash
git push -u origin local-postgres-and-password-auth
```

**2. Import it into Vercel.** At [vercel.com/new](https://vercel.com/new),
choose the `Rice-Residency` repository. Vercel detects Next.js on its own — the
framework preset, build command, and output directory are all correct as
offered. Do not deploy yet; add the database first (step 3) so the first build
comes up with data.

**3. Create the database.** In the new project, go to **Storage → Create
Database → Neon (Postgres)**. Accept the free plan. Vercel writes `DATABASE_URL`
and the rest into the project's environment variables itself — there is nothing
to copy by hand.

**4. Add one more environment variable.** Under **Settings → Environment
Variables**, add:

| Name | Value | Why |
| --- | --- | --- |
| `DIRECT_URL` | the same value as `DATABASE_URL` | Prisma's CLI wants a non-pooled connection under its own name. Copy `DATABASE_URL`'s value into it. |

That is the whole list. `ALLOW_SIGNUPS` is deliberately absent — leaving it
unset is what keeps the live site read-only for strangers.

**5. Deploy.** Push, or hit **Redeploy**. The build runs `prisma generate` and
`next build`; it does not touch the database, so it cannot fail on an empty one.

**6. Fill the database.** Copy the connection string from **Storage → your
database → `.env.local` tab**, put it in this repo's `.env.local` as
`LIVE_DATABASE_URL`, then:

```bash
npm run db:push-live
```

That dumps the local database and loads it into the live one — schema, events,
people, photos-by-path, game results, everything. Open the site; it is there.

## Afterwards, whenever

**The house data changed** (a new event date, someone joined, a card night got
recorded):

```bash
npm run db:push-live
```

No redeploy. The site reads the database on every request, so it is live the
moment the push finishes. This replaces the live database wholesale, which is
the intended direction — this machine is the copy of record.

**The code changed:** `git push`. Vercel rebuilds by itself.

## Two things to know before sharing the link

**Change the passwords that matter.** Every seeded account has the password
`residency`, and that fact is written in the README, which is in the repository.
On localhost that is convenient. On a public URL it means anyone who reads the
repo can sign in as an organizer and edit the calendar. At minimum, change your
own:

```bash
npm run db:set-password -- lana@example.com   # then push it live
npm run db:push-live
```

There is no password reset email in this app, so a forgotten password is fixed
the same way.

**Nobody can upload a profile photo on the live site.** Vercel's filesystem is
read-only, and `public/uploads/` is where this app puts photos. Every face
currently in the directory is a committed file under `public/people/`, so the
live site looks right — but a person who signs in and picks a new photo gets a
polite error instead of an upload. The rest of the profile form saves normally.
To change someone's photo: drop the image in `public/people/`, point their
`avatarUrl` at it locally, and push.

## What visitors can and cannot do

| | Signed out | Signed in |
| --- | --- | --- |
| Read the calendar, events, archive, directory, standings | yes | yes |
| Open a share link | yes | yes |
| Create an account | **no** | — |
| RSVP, create events, edit a profile | no | yes |

Sign-up is closed by `src/lib/signups.ts`, both in the form and in the Server
Action behind it — hiding the link alone would leave the action reachable by
anyone who posts to it. To reopen it later, set `ALLOW_SIGNUPS=true` in Vercel's
environment variables; it is read per request, so no rebuild is needed.

## If something goes wrong

**The build fails on `@prisma/client` not being generated.** `postinstall` runs
`prisma generate`; check it survived in `package.json`.

**The site loads but every page 500s.** The database is empty or unreachable.
Confirm `DATABASE_URL` is set in Vercel and that `npm run db:push-live` finished
without errors.

**`db:push-live` says `pg_dump: command not found`.** The Postgres client tools
are not on `PATH`. `brew install postgresql@14` puts them there.

**`db:push-live` errors on `role "anon" does not exist`.** Only possible if the
live database was built by running the migrations rather than by this script —
two early migrations revoke grants from roles that only Supabase creates. The
push script sidesteps it entirely by dumping with `--no-privileges`. If you do
want to run migrations against the live database instead, create the two empty
roles there first, exactly as the README describes for a fresh local one.
