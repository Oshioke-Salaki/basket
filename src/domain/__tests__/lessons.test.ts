import { describe, expect, it } from "vitest";
import { analyzeReceipt } from "../findings";
import { effectiveReceipts, knownItems } from "../ledger";
import { deriveLessons, lessonsToRecord, mergeLesson } from "../lessons";
import { receipt } from "./fixtures";

const NOW = new Date("2026-11-09T10:00:00.000Z");

describe("lessons", () => {
  const rs = [
    receipt("Market Square", "2026-10-01", [{ item: "Rice", size: [5, "kg"], paid: 10000 }, { item: "Oil", size: [1, "l"], paid: 3000 }]),
    receipt("Shoprite Lekki", "2026-10-08", [{ item: "Rice", size: [5, "kg"], paid: 12000 }, { item: "Oil", size: [1, "l"], paid: 3300 }]),
    receipt("Market Square", "2026-10-15", [{ item: "Rice", size: [5, "kg"], paid: 10500 }]),
  ];

  it("learns usual prices, cheapest stores and cadence", () => {
    const keys = deriveLessons(rs).map((d) => d.key).sort();
    expect(keys).toContain("usual_price:rice");
    expect(keys).toContain("cheapest_store:rice");
    expect(keys).toContain("cadence:rice");
    expect(keys).toContain("best_store");
  });

  it("records a lesson only when its belief changes", () => {
    const first = lessonsToRecord(deriveLessons(rs), [], NOW);
    expect(first.length).toBeGreaterThan(0);
    expect(lessonsToRecord(deriveLessons(rs), first, NOW)).toEqual([]);
  });

  it("lets a confirmed merge join two item histories", () => {
    const a = receipt("A", "2026-10-01", [{ item: "Peak Evaporated Milk", size: [400, "g"], paid: 2300 }]);
    const b = receipt("A", "2026-10-09", [{ item: "Peak Milk Tin", size: [400, "g"], paid: 2600 }]);
    const before = analyzeReceipt(b, [a, b]).findings.map((f) => f.kind);
    expect(before).toEqual(["first_sighting"]);

    const merge = mergeLesson("peak-milk-tin", "peak-evaporated-milk", "Peak Evaporated Milk", NOW);
    const merged = effectiveReceipts({ receipts: [a, b], lessons: [merge] });
    const after = analyzeReceipt(merged[1]!, merged).findings.map((f) => f.kind);
    expect(after).toEqual(["above_usual"]);
    expect(knownItems({ receipts: [a, b], lessons: [merge] })).toHaveLength(1);
  });
});
