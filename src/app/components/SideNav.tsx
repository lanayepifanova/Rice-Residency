/* eslint-disable @next/next/no-img-element */

import { getCurrentUser } from "@/lib/auth";
import { avatarInitial } from "@/lib/server/profile";
import { signOut } from "../login/actions";

// Messages and mutuals were removed: they were links to pages this product does
// not have. Everything listed here goes somewhere real.
const navItems = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/explore", label: "People", icon: ExploreIcon },
  { href: "/archive", label: "Archive", icon: ArchiveIcon },
  { href: "/games", label: "Games", icon: GamesIcon },
  { href: "/events/new", label: "Create", icon: CreateIcon },
  { href: "/notifications", label: "Notifications", icon: NotificationsIcon },
];

export async function SideNav() {
  const user = await getCurrentUser();

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

          {user ? (
            <>
              <a className="profile-link" href="/profile">
                {user.avatarUrl ? (
                  <img className="profile-image" src={user.avatarUrl} alt="" />
                ) : (
                  <span className="profile-image" aria-hidden="true">
                    {avatarInitial(user)}
                  </span>
                )}
                <span>Profile</span>
              </a>

              <form action={signOut} className="side-nav-signout">
                <button type="submit">Sign out</button>
              </form>
            </>
          ) : (
            <a className="profile-link" href="/login">
              <span className="profile-image" aria-hidden="true">
                →
              </span>
              <span>Sign in</span>
            </a>
          )}
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

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16v13H4zM3 4h18v3H3zM10 11h4" />
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
