import { describe, expect, it } from "vitest";
import { analyzeReceipt, type Finding } from "../findings";
import { receipt } from "./fixtures";

const kinds = (fs: readonly Finding[]) => fs.map((f) => `${f.itemKey}:${f.kind}`).sort();

describe("analyzeReceipt", () => {
  it("knows nothing on the first receipt", () => {
    const first = receipt("Shoprite Lekki", "2026-10-01", [{ item: "Peak Milk", size: [400, "g"], paid: 2300 }]);
    const a = analyzeReceipt(first, [first]);
    expect(kinds(a.findings)).toEqual(["peak-milk:first_sighting"]);
    expect(a.knownLines).toBe(0);
    expect(a.netDifferenceMinor).toBe(0);
  });

  it("flags a price above the usual and measures the overspend", () => {
    const history = [
      receipt("Shoprite Lekki", "2026-10-01", [{ item: "Peak Milk", size: [400, "g"], paid: 2300 }]),
      receipt("Shoprite Lekki", "2026-10-08", [{ item: "Peak Milk", size: [400, "g"], paid: 2300 }]),
    ];
    const now = receipt("Shoprite Lekki", "2026-10-15", [{ item: "Peak Milk", size: [400, "g"], qty: 2, paid: 5060 }]);
    const a = analyzeReceipt(now, [...history, now]);
    const f = a.findings.find((x) => x.kind === "above_usual");
    expect(f).toBeDefined();
    if (f?.kind !== "above_usual") throw new Error("unreachable");
    expect(f.deltaRatio).toBeCloseTo(0.1, 5);
    expect(f.sampleSize).toBe(2);
    // 2 packs at 2,530 against a usual 2,300: 460 naira over.
    expect(f.differenceMinor).toBe(46000);
    expect(a.netDifferenceMinor).toBe(46000);
  });

  it("treats a change inside the band as usual", () => {
    const r1 = receipt("A", "2026-10-01", [{ item: "Rice", size: [5, "kg"], paid: 12000 }]);
    const r2 = receipt("A", "2026-10-09", [{ item: "Rice", size: [5, "kg"], paid: 12300 }]);
    expect(kinds(analyzeReceipt(r2, [r1, r2]).findings)).toEqual(["rice:on_usual"]);
  });

  it("ignores purchases made after the receipt being analysed", () => {
    const later = receipt("A", "2026-11-01", [{ item: "Rice", size: [5, "kg"], paid: 99000 }]);
    const earlier = receipt("A", "2026-10-01", [{ item: "Rice", size: [5, "kg"], paid: 12000 }]);
    expect(kinds(analyzeReceipt(earlier, [later, earlier]).findings)).toEqual(["rice:first_sighting"]);
  });

  it("compares different pack sizes per gram", () => {
    const r1 = receipt("A", "2026-10-01", [{ item: "Rice", size: [10, "kg"], paid: 20000 }]);
    const r2 = receipt("A", "2026-10-09", [{ item: "Rice", size: [5, "kg"], paid: 12000 }]);
    const f = analyzeReceipt(r2, [r1, r2]).findings[0]!;
    expect(f.kind).toBe("above_usual");
    if (f.kind === "above_usual") {
      expect(f.basis).toBe("measure:g");
      expect(f.deltaRatio).toBeCloseTo(0.2, 5);
    }
  });

  it("points to a cheaper store seen recently", () => {
    const r1 = receipt("Market Square", "2026-10-01", [{ item: "Rice", size: [5, "kg"], paid: 10000 }]);
    const r2 = receipt("Shoprite Lekki", "2026-10-05", [{ item: "Rice", size: [5, "kg"], paid: 12000 }]);
    const f = analyzeReceipt(r2, [r1, r2]).findings.find((x) => x.kind === "cheaper_elsewhere");
    expect(f).toMatchObject({ kind: "cheaper_elsewhere", storeName: "Market Square", couldSaveMinor: 200000 });
  });

  it("does not recommend a store price older than the window", () => {
    const r1 = receipt("Market Square", "2026-06-01", [{ item: "Rice", size: [5, "kg"], paid: 10000 }]);
    const r2 = receipt("Shoprite Lekki", "2026-10-05", [{ item: "Rice", size: [5, "kg"], paid: 12000 }]);
    expect(analyzeReceipt(r2, [r1, r2]).findings.some((x) => x.kind === "cheaper_elsewhere")).toBe(false);
  });

  it("catches shrinkflation when the pack shrinks and the price holds", () => {
    const r1 = receipt("A", "2026-10-01", [{ item: "Golden Penny Spaghetti", size: [500, "g"], paid: 1000 }]);
    const r2 = receipt("A", "2026-10-20", [{ item: "Golden Penny Spaghetti", size: [450, "g"], paid: 1000 }]);
    const f = analyzeReceipt(r2, [r1, r2]).findings.find((x) => x.kind === "shrinkflation");
    expect(f).toBeDefined();
    if (f?.kind === "shrinkflation") {
      expect(f.before).toEqual({ amount: 500, unit: "g" });
      expect(f.after).toEqual({ amount: 450, unit: "g" });
      expect(f.measureRiseRatio).toBeCloseTo(1 / 0.9 - 1, 5);
    }
  });

  it("does not call a smaller pack shrinkflation when its price fell to match", () => {
    const r1 = receipt("A", "2026-10-01", [{ item: "Sugar", size: [1, "kg"], paid: 2000 }]);
    const r2 = receipt("A", "2026-10-20", [{ item: "Sugar", size: [500, "g"], paid: 1000 }]);
    expect(analyzeReceipt(r2, [r1, r2]).findings.some((x) => x.kind === "shrinkflation")).toBe(false);
  });

  it("never compares across currencies", () => {
    const r1 = receipt("A", "2026-10-01", [{ item: "Rice", size: [5, "kg"], paid: 10 }], { currency: "USD", usdPerUnit: 1 });
    const r2 = receipt("A", "2026-10-09", [{ item: "Rice", size: [5, "kg"], paid: 12000 }]);
    expect(kinds(analyzeReceipt(r2, [r1, r2]).findings)).toEqual(["rice:first_sighting"]);
  });
});
