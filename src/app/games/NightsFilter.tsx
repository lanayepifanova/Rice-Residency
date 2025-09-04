"use client";

import { useSearchParams } from "next/navigation";
import type { GameNight } from "@/lib/server/games";
import { NightsList } from "./NightsSection";

/**
 * The filtered view of the log, once the page is in a browser.
 *
 * `useSearchParams` cannot be resolved while prerendering under
 * `output: export`, so this suspends during the build and the page renders
 * `NightsList` unfiltered in its place — which is both the correct no-JavaScript
 * view and the reason every night ends up in the built HTML. Once React takes
 * over, this replaces it and the chips work: reading the URL through the router
 * rather than off `window` is what makes them react to a client-side navigation,
 * which does not fire a `popstate` for a listener to catch.
 */
export function NightsFilter({
  nights,
  names,
}: {
  nights: GameNight[];
  names: Array<{ name: string; slug: string }>;
}) {
  const requested = useSearchParams().get("game")?.trim() ?? "";
  // An unknown slug shows everything rather than an empty page pretending the
  // house has never played.
  const filter = names.some((game) => game.slug === requested) ? requested : "";

  return <NightsList nights={nights} names={names} filter={filter} />;
}
