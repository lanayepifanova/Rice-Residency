import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { listInbox, markInboxRead, unreadCount } from "@/lib/server/notifications";
import { relativeDay } from "@/lib/domain/format";
import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export const dynamic = "force-dynamic";

async function markAllRead() {
  "use server";

  const user = await requireUser("/notifications");
  await markInboxRead(user.id);
  revalidatePath("/notifications");
}

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const [items, unread] = await Promise.all([listInbox(user.id), unreadCount(user.id)]);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1 className="welcome-heading">Notifications</h1>

        <div className="inbox-header">
          <p className="field-hint">
            {unread > 0 ? `${unread} unread` : "Nothing unread"} · in-app channel
          </p>
          {unread > 0 ? (
            <form action={markAllRead}>
              <button type="submit">Mark all read</button>
            </form>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="event-empty">
            Nothing yet. Create an event or RSVP to one and updates land here.
          </p>
        ) : (
          <ul className="inbox-list">
            {items.map((item) => (
              <li key={item.deliveryId} className={item.readAt ? "inbox-item" : "inbox-item inbox-unread"}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <span className="field-hint">
                    {relativeDay(item.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}
                  </span>
                </div>
                {item.href ? <a href={item.href}>Open</a> : null}
              </li>
            ))}
          </ul>
        )}

        <p className="field-hint">
          Choose which channels reach you in <a href="/settings/profile">settings</a>.
        </p>
      </main>
    </>
  );
}
