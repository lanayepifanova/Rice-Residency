"use client";

import Link from "next/link";

/**
 * Last-resort boundary. The message is deliberately generic: an unexpected
 * failure can carry database detail, and that belongs in the server log rather
 * than on someone's screen.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="auth-main">
      <section className="auth-panel">
        <h1>Something went wrong</h1>
        <p>The page could not be loaded. Nothing you did caused this.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
        <p className="auth-hint">
          <Link href="/">Go home</Link>
        </p>
      </section>
    </main>
  );
}
