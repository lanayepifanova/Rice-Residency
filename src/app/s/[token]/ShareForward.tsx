"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { nextOccurrence, type EventCard } from "@/lib/domain/events";

/**
 * Performs the forward, in the browser, as soon as the page arrives.
 *
 * `replace` rather than `push`: the token page should not be a step in the
 * visitor's history, or pressing back would land them on it and bounce them
 * forward again.
 */
export function ShareForward({
  destination,
  dates,
}: {
  destination: string | null;
  dates: EventCard[];
}) {
  const router = useRouter();

  useEffect(() => {
    // A null destination means the link points at a series rather than a date,
    // so which date it opens depends on today.
    const href = destination ?? nextOccurrence(dates, Date.now())?.href ?? "/";

    router.replace(href);
  }, [destination, dates, router]);

  return null;
}
