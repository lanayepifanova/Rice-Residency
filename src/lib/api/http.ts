import type { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { RsvpServiceError } from "@/lib/server/rsvp";
import { SeriesError } from "@/lib/server/series";

/**
 * The signed-in user for a route handler, or a 401 response.
 *
 * Route handlers are reachable directly, not only through the app's own UI, so
 * identity is read from the verified Supabase session on every call. Nothing
 * about the caller is ever taken from a request header — a header is written by
 * whoever made the request, which makes it a claim, not a fact.
 */
export async function requireApiUser(): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "You need to be signed in." }, { status: 401 }),
    };
  }

  return { ok: true, userId: user.id };
}

export function badRequest(message: string, error?: ZodError): Response {
  return Response.json(
    { error: message, ...(error ? { issues: error.flatten() } : {}) },
    { status: 400 },
  );
}

const seriesStatus: Record<SeriesError["code"], number> = {
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  invalid: 400,
};

const rsvpStatus: Record<RsvpServiceError["code"], number> = {
  not_found: 404,
  conflict: 409,
  capacity_full: 409,
  invalid: 400,
};

/**
 * Turns a thrown service error into the right status code. Anything unexpected
 * becomes a 500 with a generic message: internal failure details belong in the
 * server log, not in a response body.
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof SeriesError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: seriesStatus[error.code] },
    );
  }

  if (error instanceof RsvpServiceError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: rsvpStatus[error.code] },
    );
  }

  console.error("Unhandled API error", error);

  return Response.json({ error: "Something went wrong." }, { status: 500 });
}

/** Parses a JSON body without throwing on empty or malformed input. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}
