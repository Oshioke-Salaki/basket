import { MemWalMock } from "@mysten-incubation/memwal";
import { describe, expect, it } from "vitest";
import { receipt } from "@/domain/__tests__/fixtures";
import { mergeLesson } from "@/domain/lessons";
import { decodeLesson, decodeReceipt, encodeLesson, encodeReceipt } from "../memory/codec";
import type { MemoryPort } from "../memory/port";
import { BasketMemory } from "../memory/repository";
import { reconcile } from "../memory/cache";

const NOW = new Date("2026-11-09T10:00:00.000Z");

describe("memory codec", () => {
  it("round-trips a receipt through readable text", () => {
    const r = receipt("Shoprite Lekki", "2026-10-03", [{ item: "Peak Evaporated Milk", size: [400, "g"], paid: 2300 }]);
    const text = encodeReceipt(r);
    expect(text.split("\n")[0]).toBe("Grocery receipt from Shoprite Lekki on Oct 3, 2026, ₦2,300 in total.");
    expect(text).toContain("- Peak Evaporated Milk 400g: ₦2,300");
    expect(decodeReceipt(text)).toEqual(r);
  });

  it("round-trips a lesson", () => {
    const l = mergeLesson("peak-milk-tin", "peak-evaporated-milk", "Peak Evaporated Milk", NOW);
    expect(decodeLesson(encodeLesson(l))).toEqual(l);
  });

  it("ignores memories that are not Basket's or are corrupted", () => {
    expect(decodeReceipt("I like coffee")).toBeNull();
    expect(decodeReceipt('basket:receipt:v1 {"id":"x"}')).toBeNull();
    expect(decodeReceipt("basket:receipt:v1 {not json")).toBeNull();
  });
});

describe("BasketMemory", () => {
  it("commits a receipt and lessons in one write and recalls them by namespace", async () => {
    const port = MemWalMock.create() as unknown as MemoryPort;
    const alice = new BasketMemory(port, "basket-alice");
    const bob = new BasketMemory(port, "basket-bob");
    const r = receipt("A", "2026-10-03", [{ item: "Rice", paid: 100 }]);
    const lesson = mergeLesson("a", "b", "B", NOW);

    const write = await alice.commit(r, [lesson]);
    expect(write.jobIds).toHaveLength(2);
    expect(write.receiptJobId).toBe(write.jobIds[0]);

    const recalled = await alice.recall();
    expect(recalled.receipts).toEqual([r]);
    expect(recalled.lessons).toEqual([lesson]);
    expect((await bob.recall()).receipts).toEqual([]);

    const statuses = await alice.status(write.jobIds);
    expect(statuses.every((s) => s.state === "done" && s.blobId)).toBe(true);
  });

  it("splits large writes into bulk batches of twenty", async () => {
    const port = MemWalMock.create() as unknown as MemoryPort;
    const lessons = Array.from({ length: 45 }, (_, i) => mergeLesson(`x${i}`, "y", "Y", NOW));
    const write = await new BasketMemory(port, "basket-c").commit(null, lessons);
    expect(write.jobIds).toHaveLength(45);
    expect(write.receiptJobId).toBeNull();
  });

  it("keeps recent local writes the relayer has not indexed yet", () => {
    const a = receipt("A", "2026-10-01", [{ item: "Rice", paid: 1 }]);
    const b = receipt("A", "2026-10-02", [{ item: "Rice", paid: 1 }]);
    const merged = reconcile({ receipts: [a], lessons: [] }, { receipts: [a, b], lessons: [] });
    expect(merged.receipts.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
  });
});
