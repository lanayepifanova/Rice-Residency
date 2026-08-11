import { describe, expect, it } from "vitest";

import { buildInstances, buildRecurrenceSummary } from "./recurrence";

describe("buildInstances", () => {
  it("supports flexible intervals", () => {
    const instances = buildInstances({
      startsAtLocal: "2026-09-07T18:30:00",
      durationMinutes: 60,
      timezone: "America/New_York",
      recurrence: {
        freq: "daily",
        interval: 5,
      },
      limit: 3,
    });

    expect(instances.map((instance) => instance.localDate)).toEqual(["2026-09-07", "2026-09-12", "2026-09-17"]);
  });

  it("caps never-ending recurrence at the 10-year horizon", () => {
    const instances = buildInstances({
      startsAtLocal: "2026-01-01T09:00:00",
      durationMinutes: 45,
      timezone: "America/New_York",
      recurrence: {
        freq: "yearly",
        interval: 1,
      },
      limit: 20,
      horizonYears: 10,
    });

    expect(instances).toHaveLength(11);
    expect(instances.at(-1)?.localDate).toBe("2036-01-01");
  });

  it("keeps localDate in the event timezone for near-midnight events", () => {
    const instances = buildInstances({
      startsAtLocal: "2026-09-07T23:30:00",
      durationMinutes: 60,
      timezone: "America/Los_Angeles",
      recurrence: {
        freq: "daily",
        interval: 1,
      },
      limit: 1,
    });

    expect(instances[0].startsAt).toBe("2026-09-08T06:30:00.000Z");
    expect(instances[0].localDate).toBe("2026-09-07");
  });

  it("keeps weekly events at the same local time across DST changes", () => {
    const instances = buildInstances({
      startsAtLocal: "2026-10-26T09:00:00",
      durationMinutes: 60,
      timezone: "America/New_York",
      recurrence: {
        freq: "weekly",
        interval: 1,
        byDay: ["MO"],
      },
      limit: 2,
    });

    expect(instances.map((instance) => instance.startsAt)).toEqual([
      "2026-10-26T13:00:00.000Z",
      "2026-11-02T14:00:00.000Z",
    ]);
    expect(instances.map((instance) => instance.localDate)).toEqual(["2026-10-26", "2026-11-02"]);
  });

  it("describes weekly rules in plain language", () => {
    expect(
      buildRecurrenceSummary({
        freq: "weekly",
        interval: 2,
        byDay: ["MO", "WE"],
      }),
    ).toBe("Every 2 weeks on MO, WE");
  });
});
