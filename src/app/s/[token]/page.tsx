import { notFound } from "next/navigation";
import { listShareTargets } from "@/lib/server/feed";
import { ShareForward } from "./ShareForward";

/**
 * Share link landing. Forwards to the ordinary public page — a date link lands
 * on that date, a series link on its next one.
 *
 * The forward matters beyond tidiness: it keeps the token out of the address
 * bar afterwards, so a screenshot of the page someone lands on, or a URL copied
 * from it, does not pass the token along by accident.
 *
 * This used to be a route handler that answered with a redirect and counted the
 * visit on the way through. Neither survives prerendering — there is no request
 * to answer and no database to count into — so it is a page now, and the
 * forward happens in the browser.
 */
/**
 * A route that is built has to be built for something, and right now there is
 * nothing: the share-link table is empty, and with no host controls left there
 * is no way to add to it from the site — a link is made by hand against the
 * database. A prerendered dynamic route with no pages under it is a build
 * error, so this floor keeps the route alive across the builds where no link
 * exists. It is not a URL anyone is given; any token that was never issued is a
 * 404, and this one says the link is no good, which is the truest thing that
 * can be said about a token that does not exist.
 *
 * Create a share link and the next build gives it a real page here.
 */
const PLACEHOLDER_TOKEN = "no-such-link";

export async function generateStaticParams() {
  const targets = await listShareTargets();

  if (targets.length === 0) {
    return [{ token: PLACEHOLDER_TOKEN }];
  }

  return targets.map((target) => ({ token: target.token }));
}

export default async function ShareLinkPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const target = (await listShareTargets()).find((candidate) => candidate.token === token);

  // A token that was never issued gets no page at all, which is the 404 it
  // deserves. Revoked ones are built, and forward to the notice that says so.
  if (!target) {
    if (token === PLACEHOLDER_TOKEN) {
      return <ShareForward destination="/explore?share=expired" dates={[]} />;
    }

    notFound();
  }

  return <ShareForward destination={target.destination} dates={target.dates} />;
}
