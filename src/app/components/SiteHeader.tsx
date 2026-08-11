/* eslint-disable @next/next/no-html-link-for-pages */

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="site-name" href="/">
        Matane
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
            <a className="profile-card" href="/profile">
              <strong>Your profile</strong>
              <span>@founder</span>
            </a>

            <a className="new-event-card" href="/events/new">
              <strong>+ New event</strong>
              <span>Create a recurring event</span>
            </a>

            <ul>
              <li>
                <a href="/messages">Messages</a>
              </li>
              <li>
                <a href="/mutuals">Mutuals</a>
              </li>
              <li>
                <a href="/feedback">Feedback</a>
              </li>
              <li>
                <a href="/help">Help center</a>
              </li>
              <li>
                <a href="/settings/profile">Profile settings</a>
              </li>
              <li>
                <a href="/logout">Log out</a>
              </li>
            </ul>
          </div>
        </details>
      </nav>
    </header>
  );
}
