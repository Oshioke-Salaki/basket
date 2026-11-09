import { describe, expect, it } from "vitest";
import { AppError } from "../errors";
import { toReceipt } from "../services/to-receipt";
import { fakeExtraction } from "../vision/fake";
import { sniffImageType } from "../vision/image";
import type { Extraction } from "../vision/extraction";

const ctx = { id: "11111111-2222-3333-4444-555555555555", now: new Date("2026-11-09T10:00:00Z"), homeCurrency: "NGN", usdPerUnit: 0.00065, checkpoint: "123" };
const fixture = (n: number): Extraction => fakeExtraction(Buffer.from(`basket-fixture:${n}`));

describe("toReceipt", () => {
  it("converts printed amounts to minor units and sizes to base measures", () => {
    const r = toReceipt(fixture(0), ctx);
    expect(r.currency).toBe("NGN");
    expect(r.lines[0]).toMatchObject({ itemKey: "peak-evaporated-milk", totalMinor: 230000, size: { amount: 400, unit: "g" } });
    expect(r.lines[1]!.size).toEqual({ amount: 5000, unit: "g" });
    expect(r.totalMinor).toBe(1960000);
    expect(r.store).toEqual({ key: "shoprite-lekki", name: "Shoprite Lekki" });
  });

  it("refuses an unreadable image with the model's reason", () => {
    const unreadable = fakeExtraction(Buffer.from("basket-fixture:unreadable"));
    expect(() => toReceipt(unreadable, ctx)).toThrow(AppError);
    expect(() => toReceipt(unreadable, ctx)).toThrow(/cat/);
  });

  it("drops zero-priced lines and refuses a receipt with none left", () => {
    const e = fixture(0);
    e.lines = e.lines.map((l) => ({ ...l, line_total: 0 }));
    expect(() => toReceipt(e, ctx)).toThrow(/No priced items/);
  });

  it("never dates a receipt in the future and falls back to today", () => {
    expect(toReceipt({ ...fixture(0), purchased_on: "2027-01-01" }, ctx).purchasedOn).toBe("2026-11-09");
    expect(toReceipt({ ...fixture(0), purchased_on: null }, ctx).purchasedOn).toBe("2026-11-09");
  });

  it("falls back to the household currency when the read code is not ISO", () => {
    expect(toReceipt({ ...fixture(0), currency: "N" }, ctx).currency).toBe("NGN");
  });

  it("canonicalises keys the model returned loosely", () => {
    const e = fixture(0);
    e.lines[0]!.item_key = "Peak Evaporated Milk!";
    expect(toReceipt(e, ctx).lines[0]!.itemKey).toBe("peak-evaporated-milk");
  });

  it("uses line sums when the printed total is implausible", () => {
    expect(toReceipt({ ...fixture(0), total: 5 }, ctx).totalMinor).toBe(1960000);
  });
});

describe("sniffImageType", () => {
  it("recognises images by their bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7 hello"))).toBeNull();
  });
});
