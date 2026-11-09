import { describe, expect, it } from "vitest";
import { personalInflation, primaryCurrency } from "../inflation";
import { storeStandings } from "../stores";
import { runway, weeklySpend } from "../spend";
import { receipt } from "./fixtures";

describe("personalInflation", () => {
  it("is unknown until an item has been bought twice a week apart", () => {
    const only = [receipt("A", "2026-10-01", [{ item: "Rice", paid: 100 }]), receipt("A", "2026-10-03", [{ item: "Rice", paid: 150 }])];
    expect(personalInflation(only).changeRatio).toBeNull();
  });

  it("weights each item's change by what the household spends on it", () => {
    const rs = [
      receipt("A", "2026-10-01", [{ item: "Rice", paid: 300 }, { item: "Salt", paid: 100 }]),
      receipt("A", "2026-10-15", [{ item: "Rice", paid: 330 }, { item: "Salt", paid: 100 }]),
    ];
    const pi = personalInflation(rs);
    // Rice: +10% on 630/830 of spend; salt flat.
    expect(pi.changeRatio).toBeCloseTo(0.1 * (630 / 830), 6);
    expect(pi.series.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-15"]);
    expect(pi.series[0]!.value).toBe(100);
    expect(pi.movers[0]!.itemKey).toBe("rice");
  });

  it("can restate the basket in dollars", () => {
    const rs = [
      receipt("A", "2026-10-01", [{ item: "Rice", paid: 1000 }], { usdPerUnit: 0.001 }),
      receipt("A", "2026-10-15", [{ item: "Rice", paid: 1200 }], { usdPerUnit: 0.0008 }),
    ];
    expect(personalInflation(rs, "local").changeRatio).toBeCloseTo(0.2, 6);
    expect(personalInflation(rs, "usd").changeRatio).toBeCloseTo(1.2 * 0.8 - 1, 6);
  });

  it("follows the currency the household spends most in", () => {
    const rs = [receipt("A", "2026-10-01", [{ item: "X", paid: 5 }], { currency: "USD" }), receipt("A", "2026-10-02", [{ item: "Y", paid: 5000 }])];
    expect(primaryCurrency(rs)).toBe("NGN");
  });
});

describe("storeStandings", () => {
  it("ranks stores on the household's shared items", () => {
    const rs = [
      receipt("Cheap", "2026-10-01", [{ item: "Rice", paid: 90 }, { item: "Oil", paid: 90 }]),
      receipt("Dear", "2026-10-02", [{ item: "Rice", paid: 110 }, { item: "Oil", paid: 110 }]),
    ];
    const [best, worst] = storeStandings(rs);
    expect(best!.storeName).toBe("Cheap");
    expect(best!.relativeRatio).toBeCloseTo(-0.1, 6);
    expect(worst!.relativeRatio).toBeCloseTo(0.1, 6);
  });
});

describe("weeklySpend and runway", () => {
  it("spreads spend across the observed weeks", () => {
    const rs = [receipt("A", "2026-10-01", [{ item: "Rice", paid: 7000 }]), receipt("A", "2026-10-08", [{ item: "Rice", paid: 7000 }])];
    const spend = weeklySpend(rs)!;
    expect(spend.weeksObserved).toBe(2);
    expect(spend.weeklyMinor).toBe(700000);
    expect(runway(2_100_000, spend)!.weeks).toBe(3);
  });
});
