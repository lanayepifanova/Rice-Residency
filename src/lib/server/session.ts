import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Server-side sessions.
 *
 * The browser holds a random opaque token in an httpOnly cookie; the database
 * holds its SHA-256 and the expiry. Nothing about the user is encoded in the
 * cookie, so signing out — or deleting the row — revokes access immediately,
 * which a self-contained signed token cannot do.
 */

export const SESSION_COOKIE = "residency_session";

/** Long enough that nobody is asked to sign in again mid-season. */
const SESSION_DAYS = 30;

/** 256 bits of entropy: not guessable, and short enough to sit in a cookie. */
function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Plain SHA-256 rather than scrypt: unlike a password, the token is already
 * full-entropy random, so there is nothing for an attacker to guess faster than
 * brute force, and this runs on every single request.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function expiryFromNow(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Starts a session for a user and writes the cookie.
 *
 * Only callable from a Server Action or Route Handler — Server Components are
 * not allowed to set cookies.
 */
export async function createSession(userId: string): Promise<void> {
  const token = mintToken();
  const expiresAt = expiryFromNow();

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Not `secure`: this app runs on http://localhost, where a secure cookie
    // would simply never be sent back.
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * The user id for the current request's cookie, or null.
 *
 * Expired rows are deleted on encounter rather than by a scheduled job: there
 * is no cron on a laptop, and this keeps the table from growing forever.
 */
export async function readSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({ where: { tokenHash: session.tokenHash } })
      .catch(() => undefined);
    return null;
  }

  return session.userId;
}

/** Ends the current session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .delete({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }

  cookieStore.delete(SESSION_COOKIE);
}
