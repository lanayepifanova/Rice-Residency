"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * The public origin of this deployment, used to build the magic-link redirect.
 * Derived from the request rather than hardcoded so the same code works on
 * localhost, preview deployments, and production.
 */
async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

/**
 * Only allow redirects to paths inside this app. Without this check, an
 * attacker could craft /login?next=https://evil.example and use the sign-in
 * flow as an open redirect.
 */
function safeNextPath(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export async function sendMagicLink(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    redirect(`/login?error=invalid-email&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createSupabaseServerClient();
  const origin = await siteOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/login?error=send-failed&next=${encodeURIComponent(next)}`);
  }

  redirect(`/login?sent=${encodeURIComponent(parsed.data)}&next=${encodeURIComponent(next)}`);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
