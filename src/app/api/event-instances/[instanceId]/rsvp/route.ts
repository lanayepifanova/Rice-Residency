import { rsvpSchema } from "@/lib/api/contracts";
import { badRequest, errorResponse, readJson, requireApiUser } from "@/lib/api/http";
import { submitRsvp, toServiceError } from "@/lib/server/rsvp";

/**
 * `PUT /event-instances/{id}/rsvp`
 *
 * The body may only ask for `going`, `maybe`, or `busy`. `waitlisted` is
 * assigned by the server when capacity is full, so it is not accepted here —
 * otherwise anyone could put themselves on a waitlist that has room, or off one
 * that does not.
 */
export async function PUT(
  request: Request,
  context: RouteContext<"/api/event-instances/[instanceId]/rsvp">,
) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const body = await readJson(request);

  if (body === null) {
    return badRequest("Send a JSON body.");
  }

  const parsed = rsvpSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid RSVP request.", parsed.error);
  }

  const { instanceId } = await context.params;

  try {
    const outcome = await submitRsvp({
      instanceId,
      userId: auth.userId,
      status: parsed.data.status,
      guestCount: parsed.data.guestCount,
    });

    return Response.json({
      instanceId,
      rsvp: {
        status: outcome.rsvp.status,
        guestCount: outcome.rsvp.guestCount,
        partySize: outcome.rsvp.partySize,
        waitlistRank: outcome.rsvp.waitlistRank,
      },
      capacity: outcome.capacity,
      promotedUserIds: outcome.promotedUserIds,
    });
  } catch (error) {
    return errorResponse(toServiceError(error));
  }
}
