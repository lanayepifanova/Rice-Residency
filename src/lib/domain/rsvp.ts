export type RsvpStatus = "going" | "maybe" | "busy" | "waitlisted";

/** The statuses a user may ask for. `waitlisted` is only ever system-assigned. */
export type RequestedRsvpStatus = Exclude<RsvpStatus, "waitlisted">;

export type RsvpErrorCode = "invalid_guest_count" | "capacity_full";

export class RsvpError extends Error {
  constructor(
    readonly code: RsvpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RsvpError";
  }
}

export type ExistingRsvp = {
  userId: string;
  status: RsvpStatus;
  guestCount: number;
  waitlistRank?: number | null;
};

export type ApplyRsvpInput = {
  userId: string;
  requestedStatus: RequestedRsvpStatus;
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

/** Seats a single RSVP consumes. Only `going` occupies capacity. */
export function seatsFor(status: RsvpStatus, guestCount: number): number {
  return status === "going" ? 1 + guestCount : 0;
}

export function seatsTaken(rsvps: ExistingRsvp[]): number {
  return rsvps.reduce((total, rsvp) => total + seatsFor(rsvp.status, rsvp.guestCount), 0);
}

export function applyRsvp(input: ApplyRsvpInput): ApplyRsvpResult {
  if (!Number.isInteger(input.guestCount) || input.guestCount < 0) {
    throw new RsvpError("invalid_guest_count", "Guest count must be a non-negative integer.");
  }

  const partySize = seatsFor(input.requestedStatus, input.guestCount);

  // The requester's own previous RSVP is excluded so that changing an existing
  // "going" answer is measured against the seats everyone else holds, not
  // against a total that still counts the seats being given back.
  const others = input.existingRsvps.filter((rsvp) => rsvp.userId !== input.userId);
  const capacityUsedByOthers = seatsTaken(others);

  if (input.capacity === null || input.requestedStatus !== "going") {
    return {
      status: input.requestedStatus,
      guestCount: input.guestCount,
      partySize,
      waitlistRank: null,
      capacityUsed: capacityUsedByOthers + partySize,
      capacityRemaining:
        input.capacity === null
          ? null
          : Math.max(input.capacity - capacityUsedByOthers - partySize, 0),
    };
  }

  const remaining = input.capacity - capacityUsedByOthers;

  if (partySize <= remaining) {
    return {
      status: "going",
      guestCount: input.guestCount,
      partySize,
      waitlistRank: null,
      capacityUsed: capacityUsedByOthers + partySize,
      capacityRemaining: remaining - partySize,
    };
  }

  if (!input.waitlistEnabled) {
    throw new RsvpError(
      "capacity_full",
      remaining > 0
        ? `Only ${remaining} ${remaining === 1 ? "spot is" : "spots are"} left, and the waitlist is turned off.`
        : "This event is full and the waitlist is turned off.",
    );
  }

  return {
    status: "waitlisted",
    guestCount: input.guestCount,
    partySize,
    waitlistRank: nextWaitlistRank(others),
    capacityUsed: capacityUsedByOthers,
    capacityRemaining: Math.max(remaining, 0),
  };
}

function nextWaitlistRank(others: ExistingRsvp[]): number {
  return others.filter((rsvp) => rsvp.status === "waitlisted").length + 1;
}

export type WaitlistPromotion = {
  userId: string;
  guestCount: number;
  partySize: number;
};

export type WaitlistPlan = {
  /** Entries that now fit, in the order they were waiting. */
  promoted: WaitlistPromotion[];
  /** Everyone still waiting, renumbered from 1 with no gaps. */
  reranked: Array<{ userId: string; waitlistRank: number }>;
};

/**
 * Works out who moves off the waitlist after capacity frees up.
 *
 * Promotion follows the queue strictly: the walk stops at the first party too
 * large for the seats that opened, rather than skipping ahead to a smaller one.
 * Skipping would fill more seats, but it also makes a stated position
 * meaningless — someone told they are second in line would watch people behind
 * them get in. Predictable ordering is worth the occasional empty seat.
 */
export function planWaitlistPromotions(input: {
  capacity: number | null;
  seatsUsed: number;
  waitlist: Array<{ userId: string; guestCount: number; waitlistRank: number | null }>;
}): WaitlistPlan {
  const queue = [...input.waitlist].sort(
    (a, b) => (a.waitlistRank ?? Number.MAX_SAFE_INTEGER) - (b.waitlistRank ?? Number.MAX_SAFE_INTEGER),
  );

  const promoted: WaitlistPromotion[] = [];

  if (input.capacity !== null) {
    let seatsFree = input.capacity - input.seatsUsed;

    for (const entry of queue) {
      const partySize = 1 + entry.guestCount;
      if (partySize > seatsFree) {
        break;
      }
      seatsFree -= partySize;
      promoted.push({ userId: entry.userId, guestCount: entry.guestCount, partySize });
    }
  }

  const promotedIds = new Set(promoted.map((entry) => entry.userId));
  const reranked = queue
    .filter((entry) => !promotedIds.has(entry.userId))
    .map((entry, index) => ({ userId: entry.userId, waitlistRank: index + 1 }));

  return { promoted, reranked };
}

export type CapacitySnapshot = {
  capacity: number | null;
  seatsUsed: number;
  seatsRemaining: number | null;
  isFull: boolean;
  waitlistCount: number;
};

/** What the RSVP surfaces display next to the controls. */
export function summarizeCapacity(
  capacity: number | null,
  rsvps: ExistingRsvp[],
): CapacitySnapshot {
  const seatsUsed = seatsTaken(rsvps);
  const waitlistCount = rsvps.filter((rsvp) => rsvp.status === "waitlisted").length;

  return {
    capacity,
    seatsUsed,
    seatsRemaining: capacity === null ? null : Math.max(capacity - seatsUsed, 0),
    isFull: capacity !== null && seatsUsed >= capacity,
    waitlistCount,
  };
}
