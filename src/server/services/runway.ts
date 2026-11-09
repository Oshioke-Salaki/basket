import "server-only";
import { rateBook } from "@/domain/currency";
import { effectiveReceipts, homeCurrency } from "@/domain/ledger";
import { toMinor } from "@/domain/money";
import { runway, weeklySpend } from "@/domain/spend";
import { AppError } from "../errors";
import type { Household } from "../session";
import { rate } from "../tatum/rates";
import { holdingsOf, parseSuiAddress } from "../tatum/sui";
import { loadLedger } from "./basket";

export interface RunwayReport {
  readonly address: string;
  readonly sui: { readonly amount: number; readonly usd: number };
  readonly usdc: { readonly amount: number; readonly usd: number };
  readonly otherCoins: number;
  readonly totalUsd: number;
  readonly currency: string;
  readonly holdingsMinor: number;
  readonly weeklySpendMinor: number;
  readonly weeks: number | null;
  readonly rates: { readonly suiUsd: number; readonly usdPerUnit: number; readonly asOf: string; readonly source: string };
}

/** How many weeks of this household's own groceries a Sui wallet's SUI and USDC would buy. */
export async function walletRunway(household: Household, addressInput: string): Promise<RunwayReport> {
  const address = parseSuiAddress(addressInput);
  const ledger = await loadLedger(household);
  const receipts = effectiveReceipts(ledger);
  const currency = homeCurrency(ledger);
  if (!currency) throw new AppError("bad_request", "Scan a receipt first, so Basket knows what your groceries cost.");
  const [holdings, suiUsd, local] = await Promise.all([holdingsOf(address), rate("SUI", "USD"), rate(currency, "USD")]);
  const spend = weeklySpend(receipts, currency, rateBook(receipts, { [currency]: local.value }));
  if (!spend) throw new AppError("bad_request", "Scan a receipt first, so Basket knows what your groceries cost.");
  const sui = Number(holdings.suiRaw) / 1e9;
  const usdc = Number(holdings.usdcRaw) / 1e6;
  const totalUsd = sui * suiUsd.value + usdc;
  const holdingsMinor = toMinor(totalUsd / local.value, currency);
  return {
    address,
    sui: { amount: sui, usd: sui * suiUsd.value },
    usdc: { amount: usdc, usd: usdc },
    otherCoins: holdings.otherCoins,
    totalUsd,
    currency,
    holdingsMinor,
    weeklySpendMinor: spend.weeklyMinor,
    weeks: runway(holdingsMinor, spend)?.weeks ?? null,
    rates: { suiUsd: suiUsd.value, usdPerUnit: local.value, asOf: local.asOf, source: local.source },
  };
}
