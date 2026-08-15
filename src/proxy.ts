import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`, and the
 * exported function from `middleware` to `proxy`. Supabase's published docs
 * still use the old names; this is the same pattern under the new convention.
 *
 * Its only job is refreshing the auth token cookie. Supabase access tokens are
 * short-lived, and Server Components cannot write cookies, so without this the
 * session would expire mid-session and log people out.
 *
 * Authorization deliberately does NOT live here. Public event pages must stay
 * viewable by logged-out visitors, and the Next docs recommend keeping this
 * layer thin — route-level checks happen in the pages themselves.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Must be getUser(), not getSession(): only getUser() revalidates the token
  // against Supabase and triggers the refresh that writes the cookie above.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets. Without excluding
    // these, every image request would make an auth network call.
    "/((?!_next/static|_next/image|favicon.ico|photos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
