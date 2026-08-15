import { describe, expect, it } from "vitest";

import { applyRsvp } from "./rsvp";

describe("applyRsvp", () => {
  it("counts guests against capacity for going RSVPs", () => {
    const result = applyRsvp({
      userId: "user_1",
      requestedStatus: "going",
      guestCount: 2,
      capacity: 5,
      waitlistEnabled: true,
      existingRsvps: [{ userId: "user_2", status: "going", guestCount: 1 }],
    });

    expect(result.status).toBe("going");
    expect(result.partySize).toBe(3);
    expect(result.capacityRemaining).toBe(0);
  });

  it("waitlists when capacity is full and waitlist is enabled", () => {
    const result = applyRsvp({
      userId: "user_1",
      requestedStatus: "going",
      guestCount: 0,
      capacity: 2,
      waitlistEnabled: true,
      existingRsvps: [{ userId: "user_2", status: "going", guestCount: 1 }],
    });

    expect(result.status).toBe("waitlisted");
    expect(result.waitlistRank).toBe(1);
    expect(result.capacityRemaining).toBe(0);
  });

  it("rejects when capacity is full and waitlist is disabled", () => {
    expect(() =>
      applyRsvp({
        userId: "user_1",
        requestedStatus: "going",
        guestCount: 0,
        capacity: 1,
        waitlistEnabled: false,
        existingRsvps: [{ userId: "user_2", status: "going", guestCount: 0 }],
      }),
    ).toThrow("This event is full and the waitlist is turned off.");
  });

  it("does not consume capacity for maybe or busy", () => {
    const maybe = applyRsvp({
      userId: "user_1",
      requestedStatus: "maybe",
      guestCount: 4,
      capacity: 1,
      waitlistEnabled: true,
      existingRsvps: [],
    });

    expect(maybe.status).toBe("maybe");
    expect(maybe.partySize).toBe(0);
    expect(maybe.capacityRemaining).toBe(1);
  });
});
