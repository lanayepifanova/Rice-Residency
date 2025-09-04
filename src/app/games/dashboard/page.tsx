import { Suspense } from "react";
import { GamesDashboardRedirect } from "./GamesDashboardRedirect";

/**
 * The nights moved onto `/games`, under the standings they explain. This stays
 * as a forward so links already pointing here still land on them.
 *
 * The forward happens in the browser now. It used to be a server `redirect()`,
 * which a prerendered page cannot do — there is no request to answer — and it
 * has to carry `?game=` across, which is exactly the part a built file does not
 * know.
 */
export default function GamesDashboardPage() {
  return (
    <Suspense fallback={null}>
      <GamesDashboardRedirect />
    </Suspense>
  );
}
