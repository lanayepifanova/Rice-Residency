/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @next/next/no-img-element */

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="site-name" href="/">
        {/* Decorative: the wordmark beside it already says the name. */}
        <img className="site-logo" src="/rice-residency-logo.png" alt="" />
        Rice Residency
      </a>

      <nav className="top-actions" aria-label="Main">
        <details className="menu">
          <summary aria-label="Open navigation">
            <span />
            <span />
            <span />
          </summary>

          <div className="menu-panel">
            {/* Every link here resolves to a page that exists. Entries for
                features this product does not have were removed rather than
                left pointing at nothing. */}
            <ul>
              <li>
                <a href="/">Calendar</a>
              </li>
              <li>
                <a href="/explore">People</a>
              </li>
              <li>
                <a href="/games">Games</a>
              </li>
              <li>
                <a href="/archive">Archive</a>
              </li>
            </ul>
          </div>
        </details>
      </nav>
    </header>
  );
}
