/* eslint-disable @next/next/no-img-element */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currentOrigin } from "@/lib/api/origin";
import { coverImageFor } from "@/lib/domain/event-images";
import {
  formatDay,
  formatOccurrence,
  formatTimeRange,
  relativeDay,
  timezoneLabel,
} from "@/lib/domain/format";
import { buildRecurrenceSummary } from "@/lib/domain/recurrence";
import { displayName } from "@/lib/server/profile";
import { getAttendance } from "@/lib/server/rsvp";
import { loadInstanceView, occurrenceTitle, readRecurrence } from "@/lib/server/series";
import { shareUrl } from "@/lib/server/share-links";
import { HostControls } from "../../../components/HostControls";
import { RsvpControls } from "../../../components/RsvpControls";
import { SharePanel } from "../../../components/SharePanel";
import { SideNav } from "../../../components/SideNav";
import { SiteHeader } from "../../../components/SiteHeader";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/events/[seriesId]/[instanceId]">): Promise<Metadata> {
  const { seriesId, instanceId } = await params;
  const view = await loadInstanceView(seriesId, instanceId);

  if (!view) {
    return { title: "Occurrence not found" };
  }

  const { instance } = view;
  const { title, locationName } = occurrenceTitle(view.series, instance);
  const when = formatOccurrence(instance.startsAt, view.series.timezone);

  return {
    title: `${title} · ${when} · Matane`,
    description: locationName ? `${when} · ${locationName}` : when,
    openGraph: {
      title,
      description: locationName ? `${when} · ${locationName}` : when,
      images: coverImageFor(instance.seriesId, view.series.coverImage),
    },
  };
}

export default async function InstancePage({
  params,
}: PageProps<"/events/[seriesId]/[instanceId]">) {
  const { seriesId, instanceId } = await params;
  const view = await loadInstanceView(seriesId, instanceId);

  if (!view) {
    notFound();
  }

  const { instance, series, past, cancelled } = view;
  const viewer = await getCurrentUser();
  const isHost = viewer?.id === series.organizerId;

  const [organizer, attendance] = await Promise.all([
    prisma.user.findUnique({ where: { id: series.organizerId } }),
    getAttendance(instanceId, series.capacity, viewer?.id),
  ]);

  const shareLinks = isHost
    ? await prisma.eventShareLink.findMany({
        where: { seriesId, revokedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const origin = await currentOrigin();
  const { title, description, locationName } = occurrenceTitle(series, instance);

  return (
    <>
      <SiteHeader />
      <SideNav />
      <main className="event-detail-main">
        {cancelled ? (
          <p className="banner-danger" role="status">
            {series.status === "cancelled"
              ? "This event has been cancelled by the host."
              : "This occurrence has been cancelled. Other dates in the series may still be on."}
          </p>
        ) : null}

        <p className="breadcrumb">
          <a href={`/events/${seriesId}`}>← All occurrences of {series.title}</a>
        </p>

        <article className="event-detail">
          <section className="event-detail-info">
            <h1>{title}</h1>
            <p className="event-meta">
              {formatDay(instance.startsAt, series.timezone)} ·{" "}
              {formatTimeRange(instance.startsAt, instance.endsAt, series.timezone)}{" "}
              {timezoneLabel(instance.startsAt, series.timezone)} ·{" "}
              {relativeDay(instance.startsAt, series.timezone)}
            </p>
            <p>Hosted by {organizer ? displayName(organizer) : "someone"}</p>

            {locationName ? (
              <p>
                {series.locationUrl ? (
                  <a href={series.locationUrl}>{locationName}</a>
                ) : (
                  locationName
                )}
              </p>
            ) : null}

            {description ? <p>{description}</p> : null}

            <p className="field-hint">
              Part of a series that repeats {buildRecurrenceSummary(readRecurrence(series)).toLowerCase()}.
              {instance.status === "moved"
                ? " This occurrence was moved from its usual slot."
                : ""}
            </p>

            <RsvpControls
              seriesId={seriesId}
              instanceId={instanceId}
              capacity={attendance.capacity}
              waitlistEnabled={series.waitlistEnabled}
              signedIn={Boolean(viewer)}
              cancelled={cancelled}
              past={past}
              current={
                attendance.viewerRsvp
                  ? {
                      status: attendance.viewerRsvp.status,
                      guestCount: attendance.viewerRsvp.guestCount,
                      waitlistRank: attendance.viewerRsvp.waitlistRank,
                    }
                  : null
              }
            />
          </section>

          <img
            className="event-detail-image"
            src={coverImageFor(seriesId, series.coverImage)}
            alt=""
          />
        </article>

        {isHost ? (
          <>
            <SharePanel
              seriesId={seriesId}
              instanceId={instanceId}
              links={shareLinks.map((link) => ({
                id: link.id,
                url: shareUrl(origin, link.token),
                instanceId: link.instanceId,
                openCount: link.openCount,
              }))}
            />

            <HostControls
              seriesId={seriesId}
              instanceId={instanceId}
              instanceLabel={formatDay(instance.startsAt, series.timezone)}
              title={instance.overrideTitle ?? series.title}
              description={instance.overrideDescription ?? series.description ?? ""}
              locationName={instance.overrideLocationName ?? series.locationName ?? ""}
              capacity={series.capacity}
              waitlistEnabled={series.waitlistEnabled}
              seriesCancelled={series.status === "cancelled"}
              instanceCancelled={instance.status === "cancelled"}
            />
          </>
        ) : null}
      </main>
    </>
  );
}
