import { rsvpSchema } from "@/lib/api/contracts";
import { applyRsvp } from "@/lib/domain/rsvp";
import { demoStore, rsvpKey } from "@/lib/domain/store";

type Context = {
  params: Promise<{ instanceId: string }>;
};

export async function PUT(request: Request, context: Context) {
  const body: unknown = await request.json();
  const parsed = rsvpSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid RSVP request.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { instanceId } = await context.params;
  const userId = request.headers.get("x-user-id") ?? "demo_user";
  const instance = demoStore.instances.get(instanceId);

  if (!instance) {
    return Response.json({ error: "Event instance not found." }, { status: 404 });
  }

  if (instance.status === "cancelled") {
    return Response.json({ error: "Cannot RSVP to a cancelled event instance." }, { status: 409 });
  }

  const series = demoStore.series.get(instance.seriesId);
  if (!series || series.status === "cancelled") {
    return Response.json({ error: "Event series is unavailable." }, { status: 409 });
  }

  const existingRsvps = Array.from(demoStore.rsvps.values())
    .filter((rsvp) => rsvp.instanceId === instanceId)
    .map((rsvp) => ({
      userId: rsvp.userId,
      status: rsvp.status,
      guestCount: rsvp.guestCount,
      waitlistRank: rsvp.waitlistRank,
    }));

  let result;
  try {
    result = applyRsvp({
      userId,
      requestedStatus: parsed.data.status,
      guestCount: parsed.data.guestCount,
      capacity: series.capacity,
      waitlistEnabled: series.waitlistEnabled,
      existingRsvps,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update RSVP." },
      { status: 409 },
    );
  }

  demoStore.rsvps.set(rsvpKey(instanceId, userId), {
    instanceId,
    userId,
    status: result.status,
    guestCount: result.guestCount,
    waitlistRank: result.waitlistRank,
  });

  return Response.json({
    instanceId,
    rsvp: result,
    notificationEvent: {
      type: "rsvp_changed",
      instanceId,
      payload: {
        status: result.status,
        guestCount: result.guestCount,
        partySize: result.partySize,
      },
    },
  });
}
