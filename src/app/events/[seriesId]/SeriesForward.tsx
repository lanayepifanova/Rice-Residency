"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { nextOccurrence, type EventCard } from "@/lib/domain/events";

/**
 * Sends a bare series link to one of its dates.
 *
 * Which date that is depends on when the link is opened — the next one, or the
 * most recent if they have all been and gone — so the choice cannot be made at
 * build time and baked in. The dates themselves can be, and are: they are in
 * the page, and this only picks between them.
 *
 * `replace` keeps this page out of the history, so back goes where the visitor
 * came from rather than through the forward again.
 */
export function SeriesForward({ dates }: { dates: EventCard[] }) {
  const router = useRouter();

  useEffect(() => {
    const target = nextOccurrence(dates, Date.now());

    if (target) {
      router.replace(target.href);
    }
  }, [dates, router]);

  return null;
}
