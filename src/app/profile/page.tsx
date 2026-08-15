/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDay } from "@/lib/domain/format";
import { attendedEvents, attendingEvents, hostedEvents } from "@/lib/server/feed";
import { avatarInitial, displayName } from "@/lib/server/profile";
import { EventSection } from "../components/EventGrid";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/profile");

  const [hosting, attending, attended] = await Promise.all([
    hostedEvents(user.id, 6),
    attendingEvents(user.id, 6),
    attendedEvents(user.id, 6),
  ]);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <section className="profile-header">
          {user.avatarUrl ? (
            <img className="profile-photo-large" src={user.avatarUrl} alt="" />
          ) : (
            <span className="profile-photo-large" aria-hidden="true">
              {avatarInitial(user)}
            </span>
          )}

          <div>
            <h1 className="welcome-heading">{displayName(user)}</h1>
            {user.username ? <p className="event-meta">@{user.username}</p> : null}
            {user.bio ? <p>{user.bio}</p> : null}

            <p className="field-hint">
              Joined {formatDay(user.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}
              {user.birthday ? ` · Birthday ${user.birthday}` : ""}
            </p>

            <p className="profile-socials">
              {user.instagram ? (
                <a href={`https://instagram.com/${user.instagram.replace(/^@/, "")}`}>Instagram</a>
              ) : null}
              {user.twitter ? (
                <a href={`https://x.com/${user.twitter.replace(/^@/, "")}`}>Twitter</a>
              ) : null}
              <a href="/settings/profile">Edit profile</a>
            </p>
          </div>
        </section>

        <EventSection
          title="Hosting"
          events={hosting}
          empty={
            <>
              Nothing yet. <Link href="/events/new">Create an event</Link>.
            </>
          }
        />

        <EventSection
          title="Going to"
          events={attending}
          empty={
            <>
              No upcoming plans. <Link href="/explore">Find something</Link>.
            </>
          }
        />

        <EventSection
          title="Been to"
          events={attended}
          empty={<>Events you attended will collect here.</>}
        />
      </main>
    </>
  );
}
