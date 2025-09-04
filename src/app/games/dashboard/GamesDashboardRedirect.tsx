"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Forwards to `/games`, keeping the game filter if one was on the old URL.
 *
 * `replace` rather than `push` so the back button returns to wherever the stale
 * link was followed from, instead of bouncing through this page again.
 */
export function GamesDashboardRedirect() {
  const router = useRouter();
  const game = useSearchParams().get("game");

  useEffect(() => {
    router.replace(game ? `/games?game=${encodeURIComponent(game)}` : "/games");
  }, [game, router]);

  return null;
}
