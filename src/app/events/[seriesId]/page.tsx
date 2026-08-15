/* eslint-disable @next/next/no-img-element */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { coverImageFor } from "@/lib/domain/event-images";
import { formatDay, formatTimeRange, relativeDay, timezoneLabel } from "@/lib/domain/format";
import { buildRecurrenceSummary } from "@/lib/domain/recurrence";
import { summarizeCapacity } from "@/lib/domain/rsvp";
import { getAttendanceMap } from "@/lib/server/rsvp";
import { displayName } from "@/lib/server/profile";
import { currentOrigin } from "@/lib/api/origin";
import {
  getSeries,
  listOccurrenceSummaries,
  materializeSeries,
  readRecurrence,
} from "@/lib/server/series";
import { shareUrl } from "@/lib/server/share-links";
import { HostControls } from "../../components/HostControls";
import { RsvpControls } from "../../components/RsvpControls";
import { SharePanel } from "../../components/SharePanel";
import { SideNav } from "../../components/SideNav";
import { SiteHeader } from "../../components/SiteHeader";

export const dynamic = "force-dynamic";

/**
 * Share previews carry the title, when it happens, and where — the same things
 * the public page already shows. Nothing about who is attending goes into a
 * preview, since previews are unfurled by third-party services.
 */
export async function generateMetadata({
  params,
}: PageProps<"/events/[seriesId]">): Promise<Metadata> {
  const { seriesId } = await params;
  const series = await getSeries(seriesId);

  if (!series || series.visibility !== "public") {
    return { title: "Event not found" };
  }

  const summary = buildRecurrenceSummary(readRecurrence(series));
  const where = series.locationName ? ` · ${series.locationName}` : "";

  return {
    title: `${series.title} · Matane`,
    description: `${summary}${where}`,
    openGraph: {
      title: series.title,
      description: `${summary}${where}`,
      images: coverImageFor(series.id, series.coverImage),
    },
  };
}

export default async function SeriesPage({ params, searchParams }: PageProps<"/events/[seriesId]">) {
  const { seriesId } = await params;
  const query = await searchParams;

  const series = await getSeries(seriesId);

  if (!series || series.visibility !== "public") {
    notFound();
  }

  // Reading a series is what keeps its rolling window topped up, so an event
  // nobody looks at costs nothing to keep alive.
  await materializeSeries(seriesId);

  const viewer = await getCurrentUser();
  const isHost = viewer?.id === series.organizerId;

  const [organizer, instances] = await Promise.all([
    prisma.user.findUnique({ where: { id: series.organizerId } }),
    listOccurrenceSummaries(seriesId, { take: 12 }),
  ]);

  const attendance = await getAttendanceMap(
    instances.map((instance) => instance.id),
    viewer?.id,
  );

  const shareLinks = isHost
    ? await prisma.eventShareLink.findMany({
        where: { seriesId, revokedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const origin = await currentOrigin();
  const recurrence = readRecurrence(series);
  const next = instances[0] ?? null;
  const cancelled = series.status === "cancelled";

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main className="event-detail-main">
        {query.created ? (
          <p className="banner-success" role="status">
            Your event is live. Share the link or invite people from the host tools below.
          </p>
        ) : null}

        {cancelled ? (
          <p className="banner-danger" role="status">
            This event has been cancelled by the host.
          </p>
        ) : null}

        <article className="event-detail">
          <section className="event-detail-info">
            <h1>{series.title}</h1>
            <p className="event-meta">{buildRecurrenceSummary(recurrence)}</p>
            <p>Hosted by {organizer ? displayName(organizer) : "someone"}</p>

            {series.locationName ? (
              <p>
                {series.locationUrl ? (
                  <a href={series.locationUrl}>{series.locationName}</a>
                ) : (
                  series.locationName
                )}
              </p>
            ) : null}

            {series.description ? <p>{series.description}</p> : null}

            <p className="field-hint">
              All times shown in {series.timezone}
              {next ? ` (${timezoneLabel(next.startsAt, series.timezone)})` : ""}.
            </p>
          </section>

          <img
            className="event-detail-image"
            src={coverImageFor(series.id, series.coverImage)}
            alt=""
          />
        </article>

        <section className="occurrence-section">
          <h2>Upcoming occurrences</h2>

          {instances.length === 0 ? (
            <p className="event-empty">
              This event has no occurrences left. {isHost ? "Edit the recurrence to add more." : ""}
            </p>
          ) : (
            <ul className="occurrence-list">
              {instances.map((instance) => {
                const entry = attendance.get(instance.id);
                const capacity = summarizeCapacity(
                  series.capacity,
                  (entry?.rsvps ?? []).map((rsvp) => ({
                    userId: rsvp.userId,
                    status: rsvp.status,
                    guestCount: rsvp.guestCount,
                    waitlistRank: rsvp.waitlistRank,
                  })),
                );

                return (
                  <li key={instance.id} className="occurrence">
                    <div className="occurrence-when">
                      <a href={`/events/${seriesId}/${instance.id}`}>
                        <strong>{formatDay(instance.startsAt, series.timezone)}</strong>
                      </a>
                      <span>
                        {formatTimeRange(instance.startsAt, instance.endsAt, series.timezone)} ·{" "}
                        {relativeDay(instance.startsAt, series.timezone)}
                      </span>
                      {instance.overrideTitle ? (
                        <span className="field-hint">This occurrence: {instance.overrideTitle}</span>
                      ) : null}
                    </div>

                    <RsvpControls
                      seriesId={seriesId}
                      instanceId={instance.id}
                      capacity={capacity}
                      waitlistEnabled={series.waitlistEnabled}
                      signedIn={Boolean(viewer)}
                      cancelled={instance.status === "cancelled" || cancelled}
                      past={instance.past}
                      current={
                        entry?.viewerRsvp
                          ? {
                              status: entry.viewerRsvp.status,
                              guestCount: entry.viewerRsvp.guestCount,
                              waitlistRank: entry.viewerRsvp.waitlistRank,
                            }
                          : null
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {isHost ? (
          <>
            <SharePanel
              seriesId={seriesId}
              instanceId={next?.id ?? null}
              links={shareLinks.map((link) => ({
                id: link.id,
                url: shareUrl(origin, link.token),
                instanceId: link.instanceId,
                openCount: link.openCount,
              }))}
            />

            <HostControls
              seriesId={seriesId}
              instanceId={next?.id ?? null}
              instanceLabel={next ? formatDay(next.startsAt, series.timezone) : null}
              title={series.title}
              description={series.description ?? ""}
              locationName={series.locationName ?? ""}
              capacity={series.capacity}
              waitlistEnabled={series.waitlistEnabled}
              seriesCancelled={cancelled}
              instanceCancelled={next?.status === "cancelled"}
            />
          </>
        ) : null}
      </main>
    </>
  );
}
