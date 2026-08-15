import { randomInt } from "crypto";
import { eventImagePool } from "@/lib/domain/event-images";
import { requireUser } from "@/lib/auth";
import { SideNav } from "../../components/SideNav";
import { SiteHeader } from "../../components/SiteHeader";
import { CreateEventForm } from "./create-event-form";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  // Only signed-in users can host. Sends them to login and back here after.
  await requireUser("/events/new");

  const coverImage = eventImagePool[randomInt(eventImagePool.length)];

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main className="create-event-main">
        <h1>New event</h1>
        <CreateEventForm coverImage={coverImage} defaultTimezone="America/New_York" />
      </main>
    </>
  );
}
