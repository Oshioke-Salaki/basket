import { describe, expect, it } from "vitest";
import { convertMinor, homeCurrencyOf, homeRateOn, rateBook, receiptInHome } from "../currency";
import { chosenHomeCurrency, homeCurrencyLesson } from "../lessons";
import { weeklySpend } from "../spend";
import { tripsOf } from "../trips";
import { receipt } from "./fixtures";

const NGN = 0.00065;
const GBP = 1.27;

describe("home currency", () => {
  it("is the household's choice when it made one", () => {
    const lessons = [homeCurrencyLesson("GBP", new Date("2026-11-01T00:00:00Z"))];
    expect(chosenHomeCurrency(lessons)).toBe("GBP");
    expect(homeCurrencyOf([receipt("A", "2026-10-01", [{ item: "Rice", paid: 9000 }])], "GBP")).toBe("GBP");
  });

  it("otherwise follows where the most value is spent, not the biggest number", () => {
    const rs = [
      receipt("A", "2026-10-01", [{ item: "Rice", paid: 5000 }], { currency: "NGN", usdPerUnit: NGN }),
      receipt("B", "2026-10-02", [{ item: "Bread", paid: 20 }], { currency: "USD", usdPerUnit: 1 }),
    ];
    expect(homeCurrencyOf(rs, null)).toBe("USD");
  });
});

describe("conversion", () => {
  it("converts through USD in each currency's own digits", () => {
    expect(convertMinor(1000, "GBP", "NGN", GBP, NGN)).toBe(Math.round(10 * (GBP / NGN) * 100));
    expect(convertMinor(500, "USD", "JPY", 1, 0.0066)).toBe(Math.round(5 / 0.0066));
    expect(convertMinor(100, "GBP", "NGN", null, NGN)).toBeNull();
  });

  it("converts an old trip at the home rate of its time", () => {
    const home1 = receipt("H", "2026-06-01", [{ item: "Rice", paid: 1000 }], { usdPerUnit: 0.001 });
    const home2 = receipt("H", "2026-11-01", [{ item: "Rice", paid: 1000 }], { usdPerUnit: 0.0005 });
    const away = receipt("Tesco", "2026-06-05", [{ item: "Rice", paid: 2 }], { currency: "GBP", usdPerUnit: GBP });
    const book = rateBook([home1, home2, away]);
    expect(book.NGN).toBe(0.0005);
    expect(homeRateOn("2026-06-05", "NGN", [home1, home2, away], book)).toBe(0.001);
    expect(receiptInHome(away, "NGN", [home1, home2, away], book)).toBe(Math.round(2 * (GBP / 0.001) * 100));
  });
});

describe("trips", () => {
  const home = [
    receipt("Shoprite", "2026-10-01", [{ item: "Peak Milk", size: [400, "g"], paid: 2300 }], { usdPerUnit: NGN }),
    receipt("Shoprite", "2026-10-20", [{ item: "Peak Milk", size: [400, "g"], paid: 2300 }], { usdPerUnit: NGN }),
  ];
  const london = [
    receipt("Tesco", "2026-10-08", [{ item: "Peak Milk", size: [400, "g"], paid: 2.5 }], { currency: "GBP", usdPerUnit: GBP }),
    receipt("Sainsbury's", "2026-10-12", [{ item: "Bread", paid: 1.4 }], { currency: "GBP", usdPerUnit: GBP }),
  ];
  const paris = [receipt("Monoprix", "2026-11-02", [{ item: "Bread", paid: 2 }], { currency: "EUR", usdPerUnit: 1.08 })];
  const all = [...home, ...london, ...paris];

  it("groups foreign receipts into trips by currency and time", () => {
    const trips = tripsOf(all, "NGN", rateBook(all));
    expect(trips.map((t) => [t.currency, t.receipts.length, t.days])).toEqual([
      ["EUR", 1, 1],
      ["GBP", 2, 5],
    ]);
    const uk = trips[1]!;
    expect(uk.totalMinor).toBe(390);
    expect(uk.stores).toEqual(["Tesco", "Sainsbury's"]);
    expect(uk.totalHomeMinor).not.toBeNull();
  });

  it("prices what was bought abroad against home", () => {
    const uk = tripsOf(all, "NGN", rateBook(all)).find((t) => t.currency === "GBP")!;
    expect(uk.comparisons).toHaveLength(1);
    const milk = uk.comparisons[0]!;
    // £2.50 at 1.27 USD/GBP and 0.00065 USD/NGN is ₦4,884.62 against ₦2,300 at home.
    expect(milk.ratio).toBeCloseTo((2.5 * GBP) / NGN / 2300, 3);
  });

  it("counts every receipt in weekly spend, converted home", () => {
    const spend = weeklySpend(all, "NGN", rateBook(all))!;
    expect(spend.receipts).toBe(5);
    expect(spend.unconverted).toBe(0);
    expect(spend.currency).toBe("NGN");
  });
});
