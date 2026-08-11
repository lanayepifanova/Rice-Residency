const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/explore", label: "Explore", icon: ExploreIcon },
  { href: "/events/new", label: "Create", icon: CreateIcon },
  { href: "/messages", label: "Messages", icon: MessagesIcon },
  { href: "/notifications", label: "Notifications", icon: NotificationsIcon },
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

        <div className="side-nav-bottom">
          <a href="/settings/profile">
            <SettingsIcon />
            <span>Settings</span>
          </a>

          <a className="profile-link" href="/profile">
            <span className="profile-image" aria-hidden="true">
              L
            </span>
            <span>Profile</span>
          </a>
        </div>
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
      <circle cx="12" cy="12" r="8" />
      <path d="m14.5 9.5-2 5-3 1 2-5z" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14v10H8l-3 3z" />
    </svg>
  );
}

function NotificationsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 16H6l2-3V9a4 4 0 0 1 8 0v4z" />
      <path d="M10 19h4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}
