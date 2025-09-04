/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { coverImageFor } from "@/lib/domain/event-images";
import {
  formatDay,
  formatOccurrence,
  formatTimeRange,
  timezoneLabel,
} from "@/lib/domain/format";
import { BUILT_AT } from "@/lib/server/built-at";
import { publicOccurrenceParams } from "@/lib/server/feed";
import { displayName } from "@/lib/server/profile";
import { getAttendance } from "@/lib/server/rsvp";
import { loadInstanceView, occurrenceTitle } from "@/lib/server/series";
import { AttendanceLine } from "../../../components/AttendanceLine";
import { SideNav } from "../../../components/SideNav";
import { SiteHeader } from "../../../components/SiteHeader";

/**
 * One page per date. This is the bulk of the site — every other page is a way
 * of getting to one of these — so it is also where prerendering pays for
 * itself: the whole calendar becomes files, and nothing has to ask Postgres
 * what is on.
 */
export async function generateStaticParams() {
  return publicOccurrenceParams();
}

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
    title: `${title} · ${when} · Rice Residency`,
    description: locationName ? `${when} · ${locationName}` : when,
    openGraph: {
      title,
      description: locationName ? `${when} · ${locationName}` : when,
      images: instance.coverImage ?? coverImageFor(instance.seriesId, view.series.coverImage),
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

  const { instance, series, cancelled } = view;

  const [organizer, attendance] = await Promise.all([
    prisma.user.findUnique({ where: { id: series.organizerId } }),
    getAttendance(instanceId, series.capacity),
  ]);

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
          <Link href="/">← All dates</Link>
        </p>

        <article className="event-detail">
          <section className="event-detail-info">
            <header className="event-detail-header">
              <h1>{title}</h1>
            </header>

            <dl className="event-facts">
              <div className="event-fact">
                <dt>When</dt>
                <dd>
                  {formatDay(instance.startsAt, series.timezone)}
                  <span className="event-fact-note">
                    {formatTimeRange(instance.startsAt, instance.endsAt, series.timezone)}{" "}
                    {timezoneLabel(instance.startsAt, series.timezone)}
                    {instance.status === "moved" ? " · moved from its usual slot" : ""}
                  </span>
                </dd>
              </div>

              {locationName ? (
                <div className="event-fact">
                  <dt>Where</dt>
                  <dd>
                    {series.locationUrl ? (
                      <a href={series.locationUrl}>{locationName}</a>
                    ) : (
                      locationName
                    )}
                  </dd>
                </div>
              ) : null}

              <div className="event-fact">
                <dt>Host</dt>
                <dd>{organizer ? displayName(organizer) : "someone"}</dd>
              </div>
            </dl>

            {description ? (
              <div className="event-description">
                <p>{description}</p>
              </div>
            ) : null}

            <AttendanceLine
              capacity={attendance.capacity}
              cancelled={cancelled}
              startsAt={instance.startsAt.toISOString()}
              builtAt={BUILT_AT}
            />
          </section>

          <img
            className="event-detail-image"
            src={instance.coverImage ?? coverImageFor(seriesId, series.coverImage)}
            alt=""
          />
        </article>

      </main>
    </>
  );
}
