"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { claimInvites } from "@/lib/server/series";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/server/password";
import { createSession, destroySession } from "@/lib/server/session";

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(200);

/**
 * Only allow redirects to paths inside this app. Without this check, an
 * attacker could craft /login?next=https://evil.example and use the sign-in
 * flow as an open redirect.
 */
function safeNextPath(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function backToLogin(mode: "signin" | "signup", error: string, next: string): never {
  const params = new URLSearchParams({ error, next });

  if (mode === "signup") {
    params.set("mode", "signup");
  }

  redirect(`/login?${params.toString()}`);
}

/**
 * Everything that happens once credentials check out, for both entry points:
 * start the session, then attach any invites that were addressed to this email
 * before the account existed.
 */
async function completeSignIn(userId: string, email: string, next: string): Promise<never> {
  await createSession(userId);
  await claimInvites(userId, email);

  redirect(next);
}

export async function signIn(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const email = emailSchema.safeParse(formData.get("email"));
  const password = z.string().safeParse(formData.get("password"));

  if (!email.success || !password.success) {
    backToLogin("signin", "invalid-credentials", next);
  }

  const user = await prisma.user.findUnique({ where: { email: email.data } });

  // One message for "no such account", "no password set", and "wrong password"
  // alike. Distinguishing them would turn this form into a way to check which
  // email addresses are in the house directory.
  if (!user?.passwordHash || !(await verifyPassword(password.data, user.passwordHash))) {
    backToLogin("signin", "invalid-credentials", next);
  }

  await completeSignIn(user.id, user.email, next);
}

export async function signUp(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));

  if (!email.success) {
    backToLogin("signup", "invalid-email", next);
  }

  if (!password.success) {
    backToLogin("signup", "weak-password", next);
  }

  const existing = await prisma.user.findUnique({ where: { email: email.data } });

  // A row can already exist without credentials: seeds create people, and an
  // invite is addressed to an email long before anyone signs up. Claiming one
  // of those is how an invited person gets their account, so it sets the
  // password instead of refusing.
  if (existing?.passwordHash) {
    backToLogin("signup", "email-taken", next);
  }

  const passwordHash = await hashPassword(password.data);

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
    : await prisma.user.create({ data: { email: email.data, passwordHash } });

  await completeSignIn(user.id, user.email, next);
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
