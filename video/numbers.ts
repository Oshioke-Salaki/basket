/** Every number the film shows or says, computed from the demo household with Basket's own domain code. */
import { readFileSync, writeFileSync } from "node:fs";
import { analyzeReceipt } from "@/domain/findings";
import { personalInflation, primaryCurrency } from "@/domain/inflation";
import { effectiveReceipts } from "@/domain/ledger";
import { nextShop } from "@/domain/next-shop";
import { storeStandings } from "@/domain/stores";
import { rateBook } from "@/domain/currency";
import { tripsOf } from "@/domain/trips";
import { weeklySpend } from "@/domain/spend";

const ledger = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const receipts = effectiveReceipts(ledger);
const home = primaryCurrency(receipts)!;
const last = receipts[receipts.length - 1]!;
const analysis = analyzeReceipt(last, receipts);
const inflation = personalInflation(receipts, "local", home);
const book = rateBook(receipts);
const out = {
  home,
  receipts: receipts.map((r) => ({ id: r.id, store: r.store.name, date: r.purchasedOn, currency: r.currency, total: r.totalMinor, lines: r.lines.map((l) => ({ name: l.itemName, raw: l.raw, total: l.totalMinor, qty: l.quantity })) })),
  memories: ledger.receipts.length + ledger.lessons.length,
  lessons: ledger.lessons.length,
  lastReceipt: { id: last.id, store: last.store.name, date: last.purchasedOn, findings: analysis.findings, net: analysis.netDifferenceMinor, couldSave: analysis.couldSaveMinor },
  inflation: { change: inflation.changeRatio, since: inflation.sinceDate, items: inflation.itemsTracked, series: inflation.series, movers: inflation.movers.slice(0, 5) },
  stores: storeStandings(receipts, home),
  nextShop: nextShop(receipts, "2026-11-13", home),
  trips: tripsOf(receipts, home, book).map((t) => ({ currency: t.currency, from: t.from, to: t.to, total: t.totalMinor, totalHome: t.totalHomeMinor, stores: t.stores, comparisons: t.comparisons })),
  weekly: weeklySpend(receipts, home, book),
};
writeFileSync(process.argv[3]!, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ memories: out.memories, inflation: out.inflation.change, since: out.inflation.since, items: out.inflation.items, last: out.lastReceipt.findings.map((f: { kind: string; itemName: string; deltaRatio?: number; storeName?: string }) => `${f.itemName}:${f.kind}${f.deltaRatio ? ":" + f.deltaRatio.toFixed(3) : ""}${f.storeName ? "@" + f.storeName : ""}`), stores: out.stores.map((s) => `${s.storeName} ${s.relativeRatio.toFixed(3)}`), trips: out.trips.map((t) => t.comparisons.map((c: { itemName: string; ratio: number }) => `${c.itemName} ${c.ratio.toFixed(2)}x`)), next: out.nextShop?.items.map((i) => `${i.itemName} ${i.dueInDays}d @${i.storeName}`) }, null, 1));
