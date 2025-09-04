"use client";

import { useSearchParams } from "next/navigation";

/**
 * The banner a dead share link lands on.
 *
 * A client component because the flag arrives in the query string, and the page
 * it sits on is prerendered — there is no server left at request time to read
 * `?share=expired` for it. It renders nothing by default, so unlike the games
 * log it loses nothing by being absent from the built HTML.
 */
export function ShareExpiredNotice() {
  const params = useSearchParams();

  if (params.get("share") !== "expired") {
    return null;
  }

  return (
    <p className="banner-danger" role="status">
      That share link has been revoked or never existed.
    </p>
  );
}
