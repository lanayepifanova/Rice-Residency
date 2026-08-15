import { randomBytes } from "crypto";
import type { EventInstance, EventSeries, EventShareLink } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordNotifications } from "./notifications";
import { SeriesError } from "./series";

/**
 * 24 random bytes, URL-safe. Share links are the only way an unlisted URL is
 * handed out, so the token has to be unguessable rather than merely unique —
 * a sequential id would let anyone walk the list of events.
 */
function createToken(): string {
  return randomBytes(24).toString("base64url");
}

export type ShareTarget =
  | { kind: "series"; seriesId: string }
  | { kind: "instance"; instanceId: string };

export async function createShareLink(
  target: ShareTarget,
  userId: string,
): Promise<EventShareLink> {
  if (target.kind === "series") {
    const series = await prisma.eventSeries.findUnique({ where: { id: target.seriesId } });

    if (!series) {
      throw new SeriesError("not_found", "Event not found.");
    }
    if (series.organizerId !== userId) {
      throw new SeriesError("forbidden", "Only the host can share this event.");
    }

    return prisma.eventShareLink.create({
      data: { token: createToken(), seriesId: series.id, createdById: userId },
    });
  }

  const instance = await prisma.eventInstance.findUnique({
    where: { id: target.instanceId },
    include: { series: true },
  });

  if (!instance) {
    throw new SeriesError("not_found", "Occurrence not found.");
  }
  if (instance.series.organizerId !== userId) {
    throw new SeriesError("forbidden", "Only the host can share this occurrence.");
  }

  return prisma.eventShareLink.create({
    data: {
      token: createToken(),
      seriesId: instance.seriesId,
      instanceId: instance.id,
      createdById: userId,
    },
  });
}

export async function revokeShareLink(linkId: string, userId: string): Promise<void> {
  const link = await prisma.eventShareLink.findUnique({
    where: { id: linkId },
    include: { series: true },
  });

  if (!link) {
    throw new SeriesError("not_found", "Share link not found.");
  }
  if (link.series?.organizerId !== userId) {
    throw new SeriesError("forbidden", "Only the host can revoke this link.");
  }

  await prisma.eventShareLink.update({
    where: { id: linkId },
    data: { revokedAt: new Date() },
  });
}

export type ResolvedShare = {
  link: EventShareLink;
  series: EventSeries;
  instance: EventInstance | null;
};

/**
 * Resolves a token and records the visit.
 *
 * Everything reachable this way is a public event under the MVP visibility
 * rules, so opening a link exposes nothing a visitor could not already see.
 * A revoked link stops resolving immediately.
 */
export async function resolveShareLink(token: string): Promise<ResolvedShare | null> {
  const link = await prisma.eventShareLink.findUnique({
    where: { token },
    include: { series: true, instance: true },
  });

  if (!link || link.revokedAt || !link.series) {
    return null;
  }

  await prisma.eventShareLink.update({
    where: { id: link.id },
    data: { openCount: { increment: 1 }, lastOpenedAt: new Date() },
  });

  await recordNotifications([
    {
      type: "share_opened",
      seriesId: link.seriesId,
      instanceId: link.instanceId,
      // One notification per link per day. Without a window a popular link
      // would bury every other notification the host has.
      dedupeKey: `share_opened:${link.id}:${new Date().toISOString().slice(0, 10)}`,
      payload: { title: link.series.title },
      recipientIds: [link.series.organizerId],
    },
  ]);

  return { link, series: link.series, instance: link.instance };
}

export async function listShareLinks(seriesId: string, userId: string): Promise<EventShareLink[]> {
  const series = await prisma.eventSeries.findUnique({ where: { id: seriesId } });

  if (!series) {
    throw new SeriesError("not_found", "Event not found.");
  }
  if (series.organizerId !== userId) {
    throw new SeriesError("forbidden", "Only the host can see share links.");
  }

  return prisma.eventShareLink.findMany({
    where: { seriesId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/s/${token}`;
}
