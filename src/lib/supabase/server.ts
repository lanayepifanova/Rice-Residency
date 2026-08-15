import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function readEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See .env.local.",
    );
  }

  return { url, key };
}

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * `cookies()` is async in Next.js 16, so this factory is async too — it must be
 * awaited at every call site.
 */
export async function createSupabaseServerClient() {
  const { url, key } = readEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. This is safe to swallow
          // because proxy.ts refreshes the session on every request, so the
          // rotated token is always written there instead.
        }
      },
    },
  });
}
