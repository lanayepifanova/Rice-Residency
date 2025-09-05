/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */

import { getCurrentUser } from "@/lib/auth";
import { displayName } from "@/lib/server/profile";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="site-header">
      <a className="site-name" href="/">
        {/* Decorative: the wordmark beside it already says the name. */}
        <img className="site-logo" src="/rice-residency-logo.png" alt="" />
        Rice Residency
      </a>

      <nav className="top-actions" aria-label="Main">
        <a className="create-link" href="/events/new">
          Create
        </a>

        <details className="menu">
          <summary aria-label="Open navigation">
            <span />
            <span />
            <span />
          </summary>

          <div className="menu-panel">
            {user ? (
              <a className="profile-card" href="/profile">
                <strong>Your profile</strong>
                <span>{user.username ? `@${user.username}` : displayName(user)}</span>
              </a>
            ) : (
              <a className="profile-card" href="/login">
                <strong>Sign in</strong>
                <span>Email and password</span>
              </a>
            )}

            <a className="new-event-card" href="/events/new">
              <strong>+ New event</strong>
              <span>Create a recurring event</span>
            </a>

            {/* Every link here resolves to a page that exists. Entries for
                features this product does not have were removed rather than
                left pointing at nothing. */}
            <ul>
              <li>
                <a href="/explore">People</a>
              </li>
              <li>
                <a href="/games">Games</a>
              </li>
              <li>
                <a href="/notifications">Notifications</a>
              </li>
              <li>
                <a href="/settings/profile">Profile settings</a>
              </li>
              {user ? (
                <li>
                  <a href="/logout">Log out</a>
                </li>
              ) : null}
            </ul>
          </div>
        </details>
      </nav>
    </header>
  );
}
