import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The nights moved onto `/games`, under the standings they explain. This stays
 * as a forward so links already pointing here still land on them.
 */
export default async function GamesDashboardPage({
  searchParams,
}: PageProps<"/games/dashboard">) {
  const params = await searchParams;
  const game = Array.isArray(params.game) ? params.game[0] : params.game;

  redirect(game ? `/games?game=${encodeURIComponent(game)}` : "/games");
}
