import "server-only";
import { isCurrencyCode, toMinor } from "@/domain/money";
import type { RunwayPayload } from "@/lib/api-types";
import { AppError } from "../errors";
import { rate } from "../tatum/rates";
import { holdingsOf, parseSuiAddress } from "../tatum/sui";

/**
 * A Sui wallet's SUI and USDC, read through Tatum and valued in the household's
 * currency. The browser divides it by its own weekly spend: it holds the full
 * ledger, including writes Walrus has not indexed yet.
 */
export async function walletValue(addressInput: string, currencyInput: string): Promise<RunwayPayload> {
  const address = parseSuiAddress(addressInput);
  const currency = currencyInput.trim().toUpperCase();
  if (!isCurrencyCode(currency)) throw new AppError("bad_request", "Pass the household's currency as an ISO code.");
  const [holdings, suiUsd, local] = await Promise.all([holdingsOf(address), rate("SUI", "USD"), rate(currency, "USD")]);
  const sui = Number(holdings.suiRaw) / 1e9;
  const usdc = Number(holdings.usdcRaw) / 1e6;
  const totalUsd = sui * suiUsd.value + usdc;
  return {
    address,
    sui: { amount: sui, usd: sui * suiUsd.value },
    usdc: { amount: usdc, usd: usdc },
    otherCoins: holdings.otherCoins,
    totalUsd,
    currency,
    holdingsMinor: toMinor(totalUsd / local.value, currency),
    rates: { suiUsd: suiUsd.value, usdPerUnit: local.value, asOf: local.asOf, source: local.source },
  };
}
