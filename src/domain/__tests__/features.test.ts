import { describe, expect, it } from "vitest";
import { nextShop } from "../next-shop";
import { checkPrice, roundDownToStep } from "../price-check";
import { newerVersion, reviseReceipt, RevisionError } from "../revise";
import { receipt } from "./fixtures";

const NOW = new Date("2026-11-09T10:00:00.000Z");

describe("checkPrice", () => {
  const history = [
    receipt("Market Square", "2026-10-01", [{ item: "Rice", size: [5, "kg"], paid: 11000 }]),
    receipt("Shoprite", "2026-10-15", [{ item: "Rice", size: [5, "kg"], paid: 12000 }]),
    receipt("Market Square", "2026-10-29", [{ item: "Rice", size: [5, "kg"], paid: 11200 }]),
  ];

  it("calls a quote well above the usual high and suggests a fair offer", () => {
    const c = checkPrice(history, { itemKey: "rice", quotedMinor: 1_300_000, size: null, today: "2026-11-09" })!;
    expect(c.verdict).toBe("high");
    expect(c.size).toEqual({ amount: 5000, unit: "g" });
    expect(c.lastPaid?.storeName).toBe("Market Square");
    expect(c.cheapestRecent?.storeName).toBe("Market Square");
    // Usual median 11,200; cheapest recent 11,000 → offer 11,000 rounded down to the 500 step.
    expect(c.offerMinor).toBe(1_100_000);
  });

  it("calls a quote under the usual good and suggests no offer", () => {
    const c = checkPrice(history, { itemKey: "rice", quotedMinor: 1_000_000, size: null, today: "2026-11-09" })!;
    expect(c.verdict).toBe("good");
    expect(c.offerMinor).toBeNull();
  });

  it("compares a different pack size per gram", () => {
    const c = checkPrice(history, { itemKey: "rice", quotedMinor: 560_000, size: { amount: 2500, unit: "g" }, today: "2026-11-09" })!;
    expect(c.verdict).toBe("fair");
    expect(c.quotedUnit).toBeCloseTo(22_400, 6);
  });

  it("knows nothing about an item never bought", () => {
    expect(checkPrice(history, { itemKey: "caviar", quotedMinor: 100, size: null, today: "2026-11-09" })).toBeNull();
  });

  it("rounds offers to steps people say out loud", () => {
    expect(roundDownToStep(1_123_456, "NGN")).toBe(1_100_000);
    expect(roundDownToStep(73_900, "NGN")).toBe(70_000);
    expect(roundDownToStep(1_299, "USD")).toBe(1_250);
  });
});

describe("nextShop", () => {
  const rs = [
    receipt("Market Square", "2026-10-10", [{ item: "Rice", size: [5, "kg"], paid: 11000 }, { item: "Milk", size: [400, "g"], paid: 2300 }]),
    receipt("Shoprite", "2026-10-24", [{ item: "Rice", size: [5, "kg"], paid: 12000 }, { item: "Milk", size: [400, "g"], paid: 2200 }]),
    receipt("Shoprite", "2026-10-30", [{ item: "Salt", paid: 300 }]),
  ];

  it("lists what is due and where it is cheapest", () => {
    const plan = nextShop(rs, "2026-11-05")!;
    expect(plan.items.map((i) => i.itemKey)).toEqual(["milk", "rice"]);
    const rice = plan.items.find((i) => i.itemKey === "rice")!;
    expect(rice.intervalDays).toBe(14);
    expect(rice.dueInDays).toBe(2);
    expect(rice.storeName).toBe("Market Square");
    expect(rice.expectedMinor).toBe(1_100_000);
    expect(plan.items.find((i) => i.itemKey === "milk")!.storeName).toBe("Shoprite");
    expect(plan.stops).toHaveLength(2);
    expect(plan.totalMinor).toBe(1_100_000 + 220_000);
    expect(plan.savingMinor).toBe(1_150_000 + 225_000 - plan.totalMinor);
  });

  it("leaves out items bought once and items not due within a week", () => {
    expect(nextShop(rs, "2026-10-25")!.items).toEqual([]);
  });
});

describe("reviseReceipt", () => {
  const r = receipt("A", "2026-10-01", [{ item: "Rice", paid: 100 }, { item: "Bag", paid: 5 }]);

  it("corrects a line and keeps the total in step with the lines", () => {
    const next = reviseReceipt(r, { action: "update", lineIndex: 0, itemName: "Mama Gold Rice", itemKey: null, totalMinor: 9000, quantity: 1, size: { amount: 5000, unit: "g" } }, NOW);
    expect(next.lines[0]).toMatchObject({ itemKey: "mama-gold-rice", totalMinor: 9000, raw: "RICE" });
    expect(next.totalMinor).toBe(9500);
    expect(next.revisedAt).toBe(NOW.toISOString());
    expect(newerVersion(r, next)).toBe(next);
    expect(newerVersion(next, r)).toBe(next);
  });

  it("removes a line that is not an item", () => {
    expect(reviseReceipt(r, { action: "remove", lineIndex: 1 }, NOW).lines).toHaveLength(1);
  });

  it("refuses to remove the last line or edit a line that does not exist", () => {
    const one = receipt("A", "2026-10-01", [{ item: "Rice", paid: 100 }]);
    expect(() => reviseReceipt(one, { action: "remove", lineIndex: 0 }, NOW)).toThrow(RevisionError);
    expect(() => reviseReceipt(one, { action: "remove", lineIndex: 4 }, NOW)).toThrow(RevisionError);
  });
});

import { decodeShareCard, encodeShareCard } from "../share";

describe("share cards", () => {
  it("round-trip only the numbers chosen for sharing", () => {
    const token = encodeShareCard({ r: 0.08712, u: 0.031, c: "NGN", s: "2026-10-03", n: 4 });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareCard(token)).toEqual({ r: 0.0871, u: 0.031, c: "NGN", s: "2026-10-03", n: 4 });
  });

  it("refuse tokens that are malformed or out of range", () => {
    expect(decodeShareCard("not a token!")).toBeNull();
    expect(decodeShareCard(encodeShareCard({ r: 99, u: null, c: "NGN", s: "2026-10-03", n: 4 }))).toBeNull();
  });
});

import { personalInflation } from "../inflation";

describe("honest exchange rates", () => {
  it("leaves backfilled receipts out of inflation in dollars", () => {
    const old = { ...receipt("A", "2026-09-01", [{ item: "Rice", paid: 1000 }], { usdPerUnit: 0.001 }), scannedAt: "2026-11-09T10:00:00.000Z" };
    const recent = receipt("A", "2026-11-08", [{ item: "Rice", paid: 1200 }], { usdPerUnit: 0.0008 });
    expect(personalInflation([old, recent], "local").changeRatio).toBeCloseTo(0.2, 6);
    expect(personalInflation([old, recent], "usd").changeRatio).toBeNull();
    const contemporary = { ...old, usdRateOn: "2026-09-02" };
    expect(personalInflation([contemporary, recent], "usd").changeRatio).toBeCloseTo(1.2 * 0.8 - 1, 6);
  });
});

describe("nextShop when nothing is due this week", () => {
  it("names what comes up next", () => {
    const rs = [
      receipt("Market Square", "2026-10-10", [{ item: "Rice", size: [5, "kg"], paid: 11000 }]),
      receipt("Shoprite", "2026-10-24", [{ item: "Rice", size: [5, "kg"], paid: 12000 }]),
    ];
    const plan = nextShop(rs, "2026-10-25")!;
    expect(plan.items).toEqual([]);
    expect(plan.upcoming.map((i) => [i.itemKey, i.dueInDays])).toEqual([["rice", 13]]);
  });
});
