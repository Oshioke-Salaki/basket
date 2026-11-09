import { describe, expect, it } from "vitest";
import { formatApprox, formatMoney, isCurrencyCode, toMinor } from "../money";
import { normalizeSize } from "../units";
import { slugify } from "../receipt";

describe("money and units", () => {
  it("formats minor units in the currency's own digits", () => {
    expect(formatMoney(230000, "NGN")).toBe("₦2,300");
    expect(formatMoney(1999, "USD")).toBe("$19.99");
    expect(toMinor(19.99, "USD")).toBe(1999);
    expect(toMinor(500, "JPY")).toBe(500);
  });

  it("drops minor digits from large approximate amounts only", () => {
    expect(formatApprox(305650, "NGN")).toBe("₦3,057");
    expect(formatApprox(249, "USD")).toBe("$2.49");
    expect(formatApprox(1234567, "USD")).toBe("$12,346");
  });

  it("validates currency codes", () => {
    expect(isCurrencyCode("NGN")).toBe(true);
    expect(isCurrencyCode("ngn")).toBe(false);
    expect(isCurrencyCode("ZZZ")).toBe(false);
  });

  it("normalises sizes to base measures", () => {
    expect(normalizeSize(5, "kg")).toEqual({ amount: 5000, unit: "g" });
    expect(normalizeSize(75, "cl")).toEqual({ amount: 750, unit: "ml" });
    expect(normalizeSize(1, "furlong")).toBeNull();
  });

  it("slugifies item names", () => {
    expect(slugify("Peak Milk  Évaporée & Co.")).toBe("peak-milk-evaporee-and-co");
  });
});
