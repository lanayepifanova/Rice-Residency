# Putting this on the internet

The goal: a URL that anyone in the house can open and read — the calendar, the
event pages, the directory, the card-game standings — with no account, on their
phone.

## How it works

The site is built into static files on this laptop and those files are what get
deployed. Postgres is read during the build, here, where it lives; nothing in
the datacenter ever holds a connection string, because nothing in the datacenter
runs any of this code.

```
  this laptop                              the internet
  ┌────────────────────┐                   ┌────────────────────┐
  │ Postgres 14        │                   │ the site           │
  │ rice_residency     │                   │ 102 static pages   │
  │        │           │                   │                    │
  │        │ read at   │   npm run         │ no database        │
  │        ▼ build     │   deploy ──────>  │ no server          │
  │ next build         │                   │ nothing to break   │
  │        │           │                   │                    │
  │        ▼           │                   └────────────────────┘
  │ out/               │
  └────────────────────┘
```

The database never leaves this machine and is never exposed. The trade is that
the site is a photograph rather than a window: it shows what was true when it
was built, and changing the house data means building again.

## What still updates on its own

Dates move between the home page and the archive without a rebuild. The pages
carry every date they know about along with its timestamp, and the browser
decides which side of *now* each one falls on. A Sunday session leaves the
front page the Sunday evening it happens, whether or not anyone has rebuilt
since. Same for a profile's "hosting" and "been to" lists, and for the "this has
already happened" line on a date page.

What does *not* update on its own is the data itself: a new event, a new
resident, a card night, an edited bio. Those need a build.

## Once, to set it up

**1. Sign in.** The CLI is already a dev dependency, so there is nothing to
install — but logging in is interactive and has to be done by hand:

```bash
npx vercel login
```

**2. Link the project.** From this directory:

```bash
npx vercel link
```

Choose the **existing** `rice-residency` project rather than creating a new one,
so the site keeps the `rice-residency.vercel.app` address. There is no database
to attach and no environment variable to set — `DATABASE_URL` is a build-time
secret that stays on this laptop.

**Do not connect the GitHub repository for automatic deploys.** It is the one
setting that breaks this arrangement, and it breaks it twice over: a build
triggered on Vercel runs in their datacenter, where `localhost:5432` is an empty
container. Before this repo was built into files that meant a site that answered
every request with "Something went wrong"; now it means a build that fails
outright. Either way the answer is the same — the build has to happen where the
database is, which is here. The connection was removed on 4 September 2025 for
exactly this reason; do not add it back.

## Afterwards, whenever

**The house data changed** — a new event date, someone joined, a card night got
recorded, a photo swapped:

```bash
npm run deploy
```

That runs `vercel build` here — so the database read happens on this machine —
and then uploads the finished folder with `vercel deploy --prebuilt`. The
`--prebuilt` is the whole point: it tells Vercel to publish what it is given
rather than to build anything itself. Takes about a minute.

**The code changed:** the same command; there is no separate path.

## One thing to know before sharing the link

**Profile photos are committed files, not uploads.** Every face in the directory
is an image under `public/people/`, pointed at by that person's `avatarUrl`. The
site has no upload form, so changing someone's photo is: drop the image in
`public/people/`, point their row at it, and deploy.

```bash
psql rice_residency -c "update \"User\" set \"avatarUrl\" = '/people/jane-doe.jpg' where username = 'jane-doe'"
npm run deploy
```

## What visitors can do

Everything, and nothing. Every page is public and every page is read-only:

| | Anyone with the link |
| --- | --- |
| Read the calendar, events, archive, directory, standings | yes |
| Open a share link | yes |
| Change anything at all | no |

There is no sign-in form, no sign-up form, no RSVP button, no host controls, and
no HTTP API. There is not even a server: the deployment is a folder of files, so
there is no writable surface to guard. Changes to the house data are made on
this laptop and built up.

## If something goes wrong

**The build fails on `@prisma/client` not being generated.** `postinstall` runs
`prisma generate`; check it survived in `package.json`.

**The build fails with `DATABASE_URL is not set`.** Postgres is not running, or
`.env.local` is missing. `brew services start postgresql@14`, and check the file
against `.env.example`.

**The build fails with `Can't reach database server at base`.** Nothing is
called `base`. That hostname is what a Postgres URL parser produces from the
literal string `[SENSITIVE]`, which is what `vercel build` writes into
`.vercel/.env.production.local` when the project has a `DATABASE_URL` stored on
Vercel and marked sensitive — the CLI cannot read a sensitive value back, so it
pulls down the placeholder instead. That placeholder is in the environment
before Next.js reads `.env.local`, and Next.js does not overwrite a variable
that is already set, so the real URL on this laptop never gets a turn.

The fix is to have no database variable on Vercel at all, which is the
arrangement described above:

```bash
npx vercel env rm DATABASE_URL production
npx vercel env rm DIRECT_URL production
```

`npm run build` on its own is unaffected and will keep passing, because nothing
is pulled down to shadow `.env.local`; only `npm run deploy` breaks. Two stale
variables left over from when this app ran a server in the datacenter were
removed on 4 September 2025 for this reason. Do not add them back.

**The build fails with "Page ... is missing generateStaticParams".** A new
dynamic route was added without telling the build which pages to make. Every
`[param]` folder needs a `generateStaticParams` that lists them — see
`src/app/people/[username]/page.tsx` for the shape.

**The build fails with "Cannot access searchParams" or a page suspends.** A page
tried to read the query string, which a built file does not have. Read it in a
client component instead, and give the `<Suspense>` around it a fallback that is
the real content rather than `null` — otherwise that content is missing from the
built HTML. `src/app/games/page.tsx` does this deliberately.

**The site is live but a date is on the wrong page.** That split happens in the
browser, so it is a clock question, not a build question — check the reader's
device date before rebuilding.

**A page 404s that should exist.** Static export only creates the pages
`generateStaticParams` named, so a person or event added since the last deploy
has no page until the next one. Deploy again.
