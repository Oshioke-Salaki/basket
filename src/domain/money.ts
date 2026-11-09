/**
 * Money is always held as an integer count of minor units (kobo, cents) next to
 * an ISO 4217 code. Floats only appear in derived ratios, never in stored amounts.
 */

export type CurrencyCode = string;

export interface Money {
  readonly minor: number;
  readonly currency: CurrencyCode;
}

const digitsCache = new Map<CurrencyCode, number>();

/** Number of minor-unit digits for a currency (2 for USD and NGN, 0 for JPY). */
export function fractionDigits(currency: CurrencyCode): number {
  const cached = digitsCache.get(currency);
  if (cached !== undefined) return cached;
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  digitsCache.set(currency, digits);
  return digits;
}

export function toMinor(major: number, currency: CurrencyCode): number {
  return Math.round(major * 10 ** fractionDigits(currency));
}

export function toMajor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** fractionDigits(currency);
}

let iso4217: ReadonlySet<string> | null = null;

export function isCurrencyCode(value: string): boolean {
  iso4217 ??= new Set(Intl.supportedValuesOf("currency"));
  return iso4217.has(value);
}

export interface FormatOptions {
  /** Drop the minor digits when the amount is a whole number of major units. */
  readonly compact?: boolean;
  readonly signed?: boolean;
}

export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  { compact = true, signed = false }: FormatOptions = {},
): string {
  const major = toMajor(minor, currency);
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: compact && whole ? 0 : undefined,
    maximumFractionDigits: compact && whole ? 0 : undefined,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(major);
}

export function formatPercent(ratio: number, { signed = true, digits = 1 } = {}): string {
  return new Intl.NumberFormat("en", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(ratio);
}

/**
 * A derived unit price (per 100 g, per item). Whole major units once it is 10 or
 * more, since kobo or cents on a per-100g price are noise.
 */
export function formatUnitPrice(minor: number, currency: CurrencyCode): string {
  const major = toMajor(minor, currency);
  if (Math.abs(major) >= 10) return formatMoney(Math.round(major) * 10 ** fractionDigits(currency), currency);
  return formatMoney(Math.round(minor), currency, { compact: false });
}

/**
 * A derived difference, estimate or conversion. From 100 major units up the minor
 * digits are noise (₦3,056.50 reads as ₦3,057); below that they matter ($2.49).
 */
export function formatApprox(minor: number, currency: CurrencyCode): string {
  const major = toMajor(minor, currency);
  if (Math.abs(major) < 100) return formatMoney(Math.round(minor), currency);
  return formatMoney(Math.round(major) * 10 ** fractionDigits(currency), currency);
}
