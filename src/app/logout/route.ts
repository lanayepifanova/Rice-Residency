import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/server/session";

/**
 * `/logout` exists because the header menu has always linked to it. Signing out
 * deletes the session row and clears the cookie, which is a write, so this is a
 * route handler rather than a page — a Server Component cannot set cookies.
 *
 * GET is accepted so a plain link works. That makes it reachable by a crafted
 * link on another site, but the only outcome is being signed out of your own
 * session: an annoyance, not a way to touch anyone's data.
 */
async function signOutAndRedirect(request: NextRequest) {
  await destroySession();

  return NextResponse.redirect(new URL("/login", request.url));
}

export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}
