import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/server/password";
import { signIn, signUp } from "./actions";

type LoginSearchParams = {
  error?: string;
  next?: string;
  mode?: string;
};

const errorMessages: Record<string, string> = {
  "invalid-credentials": "That email and password do not match an account.",
  "invalid-email": "That does not look like a valid email address.",
  "weak-password": `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  "email-taken": "There is already an account with that email. Sign in instead.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const { error, next, mode } = await searchParams;
  const returnTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const isSignUp = mode === "signup";

  // Already signed in — no reason to show the form.
  if (await getCurrentUser()) {
    redirect(returnTo);
  }

  const otherMode = isSignUp
    ? `/login?next=${encodeURIComponent(returnTo)}`
    : `/login?mode=signup&next=${encodeURIComponent(returnTo)}`;

  return (
    <main className="auth-main">
      <section className="auth-panel">
        <h1>Rice Residency</h1>
        <p>Recurring events with RSVPs, capacity, and waitlists.</p>

        <form action={isSignUp ? signUp : signIn}>
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

          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
              required
            />
          </label>

          {error ? (
            <p className="auth-error" role="alert">
              {errorMessages[error] ?? "Something went wrong. Please try again."}
            </p>
          ) : null}

          <button type="submit">{isSignUp ? "Create account" : "Sign in"}</button>

          <p className="auth-hint">
            {isSignUp ? (
              <>
                At least {MIN_PASSWORD_LENGTH} characters. Already have an account?{" "}
                <a href={otherMode}>Sign in</a>.
              </>
            ) : (
              <>
                New here? <a href={otherMode}>Create an account</a>.
              </>
            )}
          </p>
        </form>
      </section>
    </main>
  );
}
