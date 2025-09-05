import { describe, expect, it } from "vitest";
import { eventImagePool, seriesImageAt } from "./event-images";

/**
 * The deck's contract is that consecutive slots never repeat a photograph
 * until the pool is spent. Two consecutive dates once shared one because the
 * slot was derived from a live row count, which falls when a date is deleted
 * or when an insert is skipped as a duplicate. The slot is stored on the row
 * and allocated from a cursor that only ever rises, so these hold whatever
 * happens to the rows.
 */
describe("seriesImageAt", () => {
  const seriesId = "seed_sunday-coworking";

  it("gives every slot in one pass of the pool a different photograph", () => {
    const dealt = Array.from({ length: eventImagePool.length }, (_, slot) =>
      seriesImageAt(seriesId, slot),
    );

    expect(new Set(dealt).size).toBe(eventImagePool.length);
  });

  it("never repeats across consecutive slots", () => {
    for (let slot = 1; slot < eventImagePool.length; slot += 1) {
      expect(seriesImageAt(seriesId, slot)).not.toBe(seriesImageAt(seriesId, slot - 1));
    }
  });

  it("is stable: the same slot always deals the same photograph", () => {
    expect(seriesImageAt(seriesId, 7)).toBe(seriesImageAt(seriesId, 7));
  });

  it("deals a different order per series, so two series do not march in step", () => {
    const a = Array.from({ length: 8 }, (_, slot) => seriesImageAt("series-a", slot));
    const b = Array.from({ length: 8 }, (_, slot) => seriesImageAt("series-b", slot));

    expect(a).not.toEqual(b);
  });

  it("skipping slots cannot re-deal a spent one — the case a row count got wrong", () => {
    // Slots 0..9 are spent; rows 4..7 are then deleted. A count-based index
    // would next deal slot 6, which slot 6 already owns. A cursor deals 10.
    const spent = new Set(Array.from({ length: 10 }, (_, slot) => seriesImageAt(seriesId, slot)));

    expect(spent.has(seriesImageAt(seriesId, 6))).toBe(true);
    expect(spent.has(seriesImageAt(seriesId, 10))).toBe(false);
  });
});
