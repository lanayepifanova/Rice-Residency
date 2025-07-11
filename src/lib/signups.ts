/**
 * Whether the sign-in form will also create an account.
 *
 * The deployed site is public to read and closed to write: anyone with the link
 * should be able to browse the calendar and the directory, but a stranger who
 * finds the URL should not be able to mint an account and take a seat at a
 * dinner. So sign-up is off wherever this runs in production, and accounts are
 * made deliberately -- by seeding, or by hand in `psql`.
 *
 * Development keeps the old behaviour, because a local database that cannot
 * make its first account is not much use. Set ALLOW_SIGNUPS explicitly to
 * override either default; it is read at request time rather than at module
 * load so flipping it on Vercel takes effect without a rebuild.
 */
export function signupsOpen(): boolean {
  const flag = process.env.ALLOW_SIGNUPS;

  if (flag !== undefined) {
    return flag === "true";
  }

  return process.env.NODE_ENV !== "production";
}
