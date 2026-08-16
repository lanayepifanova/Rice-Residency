import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sendMagicLink } from "./actions";

type LoginSearchParams = {
  sent?: string;
  error?: string;
  next?: string;
};

const errorMessages: Record<string, string> = {
  "invalid-email": "That does not look like a valid email address.",
  "send-failed": "We could not send the link just now. Please try again.",
  "link-invalid": "That link has expired or was already used. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const { sent, error, next } = await searchParams;
  const returnTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // Already signed in — no reason to show the form.
  if (await getCurrentUser()) {
    redirect(returnTo);
  }

  return (
    <main className="auth-main">
      <section className="auth-panel">
        <h1>Rice Residency</h1>
        <p>Recurring events with RSVPs, capacity, and waitlists.</p>

        {sent ? (
          <div className="auth-notice" role="status">
            <h2>Check your email</h2>
            <p>
              We sent a sign-in link to <strong>{sent}</strong>. Open it on this device to continue.
            </p>
            <p className="auth-hint">
              The link expires in one hour. Nothing arrived? Check spam, then request another.
            </p>
            <a href={`/login?next=${encodeURIComponent(returnTo)}`}>Use a different email</a>
          </div>
        ) : (
          <form action={sendMagicLink}>
            <input type="hidden" name="next" value={returnTo} />

            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                autoFocus
              />
            </label>

            {error ? (
              <p className="auth-error" role="alert">
                {errorMessages[error] ?? "Something went wrong. Please try again."}
              </p>
            ) : null}

            <button type="submit">Email me a sign-in link</button>

            <p className="auth-hint">
              No password needed. If you do not have an account yet, one is created for you.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
