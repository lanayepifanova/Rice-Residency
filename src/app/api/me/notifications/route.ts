import { errorResponse, requireApiUser } from "@/lib/api/http";
import { listInbox, markInboxRead, unreadCount } from "@/lib/server/notifications";

/** `GET /me/notifications` — the in-app inbox for the signed-in user. */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  try {
    const [items, unread] = await Promise.all([
      listInbox(auth.userId),
      unreadCount(auth.userId),
    ]);

    return Response.json({ unread, notifications: items });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Marks everything read. Deliberately scoped to the caller's own rows. */
export async function POST() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  try {
    const marked = await markInboxRead(auth.userId);
    return Response.json({ marked });
  } catch (error) {
    return errorResponse(error);
  }
}
