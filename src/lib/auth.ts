import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { readSessionUserId } from "./server/session";

/**
 * The signed-in app user, or null when logged out.
 *
 * This app owns identity end to end: accounts live in the `User` table with a
 * password hash, and sessions in the `Session` table. There is no external auth
 * provider to call, so resolving the current user is a cookie lookup and one
 * query.
 *
 * Wrapped in React's `cache` so that several Server Components rendering in the
 * same request share one auth check and one query.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await readSessionUserId();

  if (!userId) {
    return null;
  }

  // The row can be gone while the cookie lives on — deleting a user cascades to
  // their sessions, but a request already in flight can still arrive here.
  return prisma.user.findUnique({ where: { id: userId } });
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
