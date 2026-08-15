import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { claimInvites } from "./server/series";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * The signed-in app user, or null when logged out.
 *
 * Supabase owns identity (`auth.users`); this table owns everything the app
 * needs to relate to events and RSVPs. The row is created lazily on first
 * sign-in rather than by a database trigger, so the linkage stays visible in
 * application code instead of hiding in the database.
 *
 * Wrapped in React's `cache` so that several Server Components rendering in
 * the same request share one auth check and one query.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();

  // getUser() revalidates the token with Supabase. getSession() only reads the
  // cookie, which is spoofable, so it must not be used for authorization.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  const appUser = await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email },
    create: { id: user.id, email: user.email },
  });

  // Invites are addressed to an email before the recipient has an account.
  // Signing in is the first moment they can be attached to a person.
  await claimInvites(appUser.id, appUser.email);

  return appUser;
});

/**
 * For pages and actions that require a session. Redirects to the login page,
 * preserving where the user was headed so they land there afterwards.
 */
export async function requireUser(returnTo?: string): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    const target = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login";
    redirect(target);
  }

  return user;
}
