/* eslint-disable @next/next/no-img-element */

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
      <main className="event-detail-main">
        <article className="event-detail">
          <section className="event-detail-info">
            <h1>{event.title}</h1>
            <p className="event-meta">{event.meta.toLowerCase()}</p>
            <p>Hosted by {event.host}</p>
            <p>{event.description}</p>

            <section>
              <h2>Event</h2>
              <p>{event.group}</p>
            </section>
          </section>

          <img className="event-detail-image" src={event.image} alt="" />
        </article>
      </main>
    </>
  );
}
