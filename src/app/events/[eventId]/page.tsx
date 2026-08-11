import { notFound } from "next/navigation";
import { SideNav } from "../../components/SideNav";
import { SiteHeader } from "../../components/SiteHeader";
import { getDemoEvent } from "@/lib/domain/demo-events";

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = getDemoEvent(eventId);

  if (!event) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1>{event.title}</h1>
        <p>{event.meta}</p>

        <section>
          <h2>Event</h2>
          <p>{event.group}</p>
        </section>
      </main>
    </>
  );
}
