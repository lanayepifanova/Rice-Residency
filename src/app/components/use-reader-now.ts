"use client";

import { useEffect, useState } from "react";

/**
 * The current time, as the person reading the page experiences it.
 *
 * Every page here is prerendered: built once, on the laptop that holds the
 * data, and then served as a file. That makes the clock the one input the build
 * cannot supply — a page built on Monday is still being read on Friday, and
 * "has this happened yet" has to have moved on.
 *
 * The first render is deliberately given `builtAt` rather than the real time.
 * React hydrates by re-rendering the component in the browser and checking it
 * against the markup it was sent; handing it a different clock than the build
 * had would make those disagree, and React would discard the server's HTML and
 * start over. So the build's own answer is rendered first, matching exactly,
 * and the correct one arrives immediately afterwards.
 */
export function useReaderNow(builtAt: number): number {
  const [now, setNow] = useState(builtAt);

  useEffect(() => {
    // The second render this schedules is the entire point of the hook, not an
    // accident: it is the step that replaces the build's clock with the
    // reader's. It happens once, on mount, and settles immediately — `Date.now`
    // cannot equal `builtAt` again, so this cannot cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  return now;
}
