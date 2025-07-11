// Messages and mutuals were removed: they were links to pages this product does
// not have. Everything listed here goes somewhere real.
const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/explore", label: "People", icon: ExploreIcon },
  { href: "/games", label: "Games", icon: GamesIcon },
  // The two standing series get their own entries: they are what the house runs,
  // so they are worth a click from anywhere rather than a scroll down the home page.
  { href: "/events/seed_friday-house-party", label: "Parties", icon: PartiesIcon },
  { href: "/events/seed_vc-networking-dinner", label: "Dinners", icon: DinnersIcon },
  { href: "/archive", label: "Archive", icon: ArchiveIcon },
];

export function SideNav() {
  return (
    <aside className="side-nav" aria-label="Primary">
      <nav className="side-nav-inner">
        <ul>
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <a href={item.href}>
                  <Icon />
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {/* Two people: one forward, one half behind. */}
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M15 14.2a4.6 4.6 0 0 1 5.5 4.8" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v13H4zM3 4h18v3H3zM10 11h4" />
    </svg>
  );
}

function PartiesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {/* A party popper: cone plus the bits coming out of it. */}
      <path d="M4 20l5-11 6 6z" />
      <path d="M14 4v2M18 6l-1.4 1.4M20 10h-2" />
    </svg>
  );
}

function DinnersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {/* Fork and knife. */}
      <path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11" />
      <path d="M16 3c2 1.5 2 5 0 6.5V21" />
    </svg>
  );
}

function GamesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {/* Two overlapping cards: the back one tilted, the front one square on. */}
      <path d="M9 4h8v13H9z" />
      <path d="M7.4 6.6 5 7.3l2.6 9.4 1.4-.4" />
      <path d="M13 8.5 14.5 11 13 13.5 11.5 11z" />
    </svg>
  );
}

