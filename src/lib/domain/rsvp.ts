export type RsvpStatus = "going" | "maybe" | "busy" | "waitlisted";

export type ExistingRsvp = {
  userId: string;
  status: RsvpStatus;
  guestCount: number;
  waitlistRank?: number | null;
};

export type ApplyRsvpInput = {
  userId: string;
  requestedStatus: Exclude<RsvpStatus, "waitlisted">;
  guestCount: number;
  capacity: number | null;
  waitlistEnabled: boolean;
  existingRsvps: ExistingRsvp[];
};

export type ApplyRsvpResult = {
  status: RsvpStatus;
  guestCount: number;
  partySize: number;
  waitlistRank: number | null;
  capacityUsed: number;
  capacityRemaining: number | null;
};

export function applyRsvp(input: ApplyRsvpInput): ApplyRsvpResult {
  if (!Number.isInteger(input.guestCount) || input.guestCount < 0) {
    throw new Error("Guest count must be a non-negative integer.");
  }

  const partySize = input.requestedStatus === "going" ? 1 + input.guestCount : 0;
  const capacityUsedWithoutUser = input.existingRsvps
    .filter((rsvp) => rsvp.userId !== input.userId)
    .reduce((sum, rsvp) => {
      if (rsvp.status !== "going") {
        return sum;
      }
      return sum + 1 + rsvp.guestCount;
    }, 0);

  if (input.capacity === null || input.requestedStatus !== "going") {
    return {
      status: input.requestedStatus,
      guestCount: input.guestCount,
      partySize,
      waitlistRank: null,
      capacityUsed: capacityUsedWithoutUser + partySize,
      capacityRemaining:
        input.capacity === null ? null : Math.max(input.capacity - capacityUsedWithoutUser - partySize, 0),
    };
  }

  const remaining = input.capacity - capacityUsedWithoutUser;
  if (partySize <= remaining) {
    return {
      status: "going",
      guestCount: input.guestCount,
      partySize,
      waitlistRank: null,
      capacityUsed: capacityUsedWithoutUser + partySize,
      capacityRemaining: remaining - partySize,
    };
  }

  if (!input.waitlistEnabled) {
    throw new Error("This event is full.");
  }

  const waitlistRank =
    input.existingRsvps.filter((rsvp) => rsvp.userId !== input.userId && rsvp.status === "waitlisted").length + 1;

  return {
    status: "waitlisted",
    guestCount: input.guestCount,
    partySize,
    waitlistRank,
    capacityUsed: capacityUsedWithoutUser,
    capacityRemaining: Math.max(remaining, 0),
  };
}
