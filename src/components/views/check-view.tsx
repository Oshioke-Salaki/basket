"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useBasket } from "@/components/basket/basket-provider";
import { CurrencyPicker } from "@/components/basket/currency-picker";
import { basisLabel } from "@/components/basket/describe";
import { EmptyBasket } from "@/components/basket/empty-basket";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Camera } from "@/components/ui/icons";
import { Label, Panel } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import { convertMinor } from "@/domain/currency";
import { formatDay, isoDay } from "@/domain/dates";
import { knownItems } from "@/domain/ledger";
import { formatMoney, formatPercent, formatUnitPrice, toMajor, toMinor } from "@/domain/money";
import { checkPrice, roundDownToStep, type PriceCheck } from "@/domain/price-check";
import { formatSize, normalizeSize, type Size } from "@/domain/units";
import { api, ApiError } from "@/lib/api";
import { prepareReceiptImage, UnsupportedImageError } from "@/lib/image";

const UNITS = ["g", "kg", "ml", "l", "pcs"] as const;

export function CheckView() {
  const { receipts, lessons, effective, home, rates, ensureRates } = useBasket();
  const items = useMemo(() => knownItems({ receipts, lessons }, 500), [receipts, lessons]);
  const ids = { item: useId(), price: useId(), currency: useId(), amount: useId(), unit: useId() };
  const [query, setQuery] = useState("");
  const [itemKey, setItemKey] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string | null>(null);
  const [sizeChoice, setSizeChoice] = useState<string>("usual");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("g");
  const [snap, setSnap] = useState<{ kind: "idle" } | { kind: "reading" } | { kind: "error"; message: string } | { kind: "unknown"; name: string }>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const item = items.find((i) => i.itemKey === itemKey) ?? null;
  const quoteCurrency = currency ?? home ?? "USD";
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || item?.itemName.toLowerCase() === q) return [];
    return items.filter((i) => i.itemName.toLowerCase().includes(q) || i.lastPrinted.toLowerCase().includes(q)).slice(0, 6);
  }, [items, query, item]);

  const size: Size | null = useMemo(() => {
    if (sizeChoice === "usual") return null;
    if (sizeChoice === "other") return amount ? normalizeSize(Number(amount), unit) : null;
    return item?.sizes.find((s) => `${s.amount}${s.unit}` === sizeChoice) ?? null;
  }, [sizeChoice, amount, unit, item]);

  const result = useMemo(() => {
    if (!item) return null;
    const major = Number(price.replace(/,/g, ""));
    if (!(major > 0)) return null;
    // Judge against the item's history in home money when it has any, else in its own currency.
    const own = effective.filter((r) => r.lines.some((l) => l.itemKey === item.itemKey));
    const historyCurrency = own.some((r) => r.currency === home) ? home! : own[own.length - 1]?.currency ?? quoteCurrency;
    const quotedMinor = toMinor(major, quoteCurrency);
    const inHistory = convertMinor(quotedMinor, quoteCurrency, historyCurrency, rates[quoteCurrency], rates[historyCurrency]);
    if (inHistory === null) return { missingRate: true as const, quoteCurrency, historyCurrency };
    const check = checkPrice(
      own.filter((r) => r.currency === historyCurrency),
      { itemKey: item.itemKey, quotedMinor: inHistory, size, today: isoDay(new Date()) },
    );
    return check ? { missingRate: false as const, check, quotedMinor, quoteCurrency, historyCurrency } : null;
  }, [item, price, quoteCurrency, home, effective, rates, size]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setSnap({ kind: "reading" });
    try {
      const tag = await api.priceTag(await prepareReceiptImage(file));
      setCurrency(tag.currency);
      void ensureRates([tag.currency]);
      setPrice(String(toMajor(tag.quotedMinor, tag.currency)));
      if (tag.itemKey) {
        const known = items.find((i) => i.itemKey === tag.itemKey);
        setItemKey(tag.itemKey);
        setQuery(known?.itemName ?? tag.itemName);
        setSnap({ kind: "idle" });
      } else {
        setQuery(tag.itemName);
        setItemKey(null);
        setSnap({ kind: "unknown", name: tag.itemName });
      }
      if (tag.size) {
        const key = `${tag.size.amount}${tag.size.unit}`;
        const seen = items.find((i) => i.itemKey === tag.itemKey)?.sizes.some((s) => `${s.amount}${s.unit}` === key);
        if (seen) setSizeChoice(key);
        else {
          setSizeChoice("other");
          setAmount(String(tag.size.amount));
          setUnit(tag.size.unit === "unit" ? "pcs" : tag.size.unit);
        }
      }
    } catch (error) {
      setSnap({ kind: "error", message: error instanceof ApiError || error instanceof UnsupportedImageError ? error.message : "The price could not be read. Type it instead." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (receipts.length === 0) return <EmptyBasket />;

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <header>
        <h1 className="text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">Price check</h1>
        <p className="mt-2 max-w-[58ch] text-muted">
          At a shelf or a market stall, check a price against everything you have paid before, in any currency, before you hand over money.
        </p>
      </header>

      <Panel>
        <div className="grid gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-soft">Type it in, or photograph the price tag.</p>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={snap.kind === "reading"}>
              {snap.kind === "reading" ? <Spinner label="Reading the price" /> : <Camera className="size-4" />}
              Snap the price
            </Button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Photo of a price tag" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          </div>
          {snap.kind === "error" ? <p className="text-sm text-rise">{snap.message}</p> : null}
          {snap.kind === "unknown" ? (
            <p className="text-sm text-soft">
              Read “{snap.name}”, which you have not bought before. Pick the matching item below if it is one of yours.
            </p>
          ) : null}

          <div className="relative grid gap-2">
            <label htmlFor={ids.item} className="text-sm font-medium text-soft">
              Item
            </label>
            <input
              id={ids.item}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setItemKey(null);
              }}
              placeholder="Start typing: rice, milk, eggs…"
              autoComplete="off"
              className="h-12 rounded-sm border border-line-strong bg-ground px-4 text-ink placeholder:text-muted focus:border-action focus:outline-none"
            />
            {matches.length ? (
              <ul className="rounded-sm border border-line bg-raised" aria-label="Matching items">
                {matches.map((m) => (
                  <li key={m.itemKey}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-2 text-left hover:bg-white/[0.04]"
                      onClick={() => {
                        setItemKey(m.itemKey);
                        setQuery(m.itemName);
                        setSizeChoice("usual");
                        setSnap({ kind: "idle" });
                      }}
                    >
                      <span>{m.itemName}</span>
                      <span className="text-sm text-muted">bought {m.timesBought}×</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <label htmlFor={ids.price} className="text-sm font-medium text-soft">
                Price asked
              </label>
              <input
                id={ids.price}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                className="h-12 rounded-sm border border-line-strong bg-ground px-4 text-lg text-ink placeholder:text-muted focus:border-action focus:outline-none"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor={ids.currency} className="text-sm font-medium text-soft">
                Currency
              </label>
              <CurrencyPicker
                id={ids.currency}
                value={quoteCurrency}
                onChange={(c) => {
                  setCurrency(c);
                  void ensureRates([c]);
                }}
              />
            </div>
          </div>

          {item ? (
            <fieldset className="grid gap-3">
              <legend className="mb-2 text-sm font-medium text-soft">Pack size</legend>
              <div className="flex flex-wrap gap-2">
                {[{ key: "usual", label: item.sizes[item.sizes.length - 1] ? `Your usual, ${formatSize(item.sizes[item.sizes.length - 1]!)}` : "Your usual" }, ...item.sizes.map((s) => ({ key: `${s.amount}${s.unit}`, label: formatSize(s) })), { key: "other", label: "Another size" }]
                  .filter((o, i, all) => all.findIndex((x) => x.label === o.label) === i)
                  .map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      aria-pressed={sizeChoice === o.key}
                      onClick={() => setSizeChoice(o.key)}
                      className={cx("h-10 rounded-full border px-4 text-sm font-medium transition-colors", sizeChoice === o.key ? "border-ink bg-ink text-ground" : "border-line-strong text-soft hover:border-ink/50")}
                    >
                      {o.label}
                    </button>
                  ))}
              </div>
              {sizeChoice === "other" ? (
                <div className="flex gap-3">
                  <label htmlFor={ids.amount} className="sr-only">
                    Size amount
                  </label>
                  <input id={ids.amount} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="500" className="h-12 w-32 rounded-sm border border-line-strong bg-ground px-4 text-ink focus:border-action focus:outline-none" />
                  <label htmlFor={ids.unit} className="sr-only">
                    Size unit
                  </label>
                  <select id={ids.unit} value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])} className="h-12 rounded-sm border border-line-strong bg-ground px-4 text-ink focus:border-action focus:outline-none">
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </fieldset>
          ) : null}
        </div>
      </Panel>

      <div aria-live="polite">
        {result?.missingRate ? (
          <Panel>
            <p className="text-soft">
              Basket has no {result.quoteCurrency} to {result.historyCurrency} rate yet. It is fetched from Tatum; try again in a moment.
            </p>
          </Panel>
        ) : result && !result.missingRate ? (
          <Verdict check={result.check} quotedMinor={result.quotedMinor} quoteCurrency={result.quoteCurrency} rates={rates} />
        ) : item ? (
          <p className="text-muted">Enter the price to see how it compares.</p>
        ) : null}
      </div>
    </div>
  );
}

const HEADLINES = {
  high: (r: number) => `High: ${formatPercent(r, { digits: 0, signed: false })} over what you usually pay`,
  good: (r: number) => `Good price: ${formatPercent(-r, { digits: 0, signed: false })} under your usual`,
  fair: () => "About what you usually pay",
  unknown: () => "Bought once before, so no usual price yet",
};

function Verdict({ check, quotedMinor, quoteCurrency, rates }: { check: PriceCheck; quotedMinor: number; quoteCurrency: string; rates: Readonly<Record<string, number>> }) {
  const money = (minor: number) => formatMoney(minor, check.currency);
  const unit = (minor: number) => formatUnitPrice(minor, check.currency);
  const converted = quoteCurrency !== check.currency;
  const label = basisLabel(check.basis);
  const offerInQuote =
    check.offerMinor !== null && converted
      ? (() => {
          const back = convertMinor(check.offerMinor, check.currency, quoteCurrency, rates[check.currency], rates[quoteCurrency]);
          return back === null ? null : roundDownToStep(back, quoteCurrency);
        })()
      : null;

  return (
    <Panel className={cx(check.verdict === "high" && "border-rise/50", check.verdict === "good" && "border-fall/50")}>
      <p className={cx("text-title font-medium", check.verdict === "high" ? "text-rise" : check.verdict === "good" ? "text-fall" : "text-ink")}>
        {HEADLINES[check.verdict](check.deltaRatio ?? 0)}
      </p>
      <p className="mt-2 text-soft">
        {check.itemName}
        {check.size ? `, ${formatSize(check.size)}` : ""} at {formatMoney(quotedMinor, quoteCurrency)}
        {converted ? ` ≈ ${money(check.quotedMinor)} at today’s rate` : ""}.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <div>
          <Label>Your usual {label}</Label>
          <p className="mt-1 text-xl font-medium">{check.usualUnit !== null ? unit(check.usualUnit) : "Not yet"}</p>
          <p className="text-sm text-muted">this ask: {unit(check.quotedUnit)}</p>
        </div>
        <div>
          <Label>Last paid</Label>
          <p className="mt-1 text-xl font-medium">{check.lastPaid ? money(check.lastPaid.packMinor) : "Never"}</p>
          {check.lastPaid ? (
            <p className="text-sm text-muted">
              {check.lastPaid.storeName}, {formatDay(check.lastPaid.date)}
              {check.lastPaid.size ? ` · ${formatSize(check.lastPaid.size)}` : ""}
            </p>
          ) : null}
        </div>
        <div>
          <Label>Cheapest lately</Label>
          <p className="mt-1 text-xl font-medium">{check.cheapestRecent ? unit(check.cheapestRecent.unit) : "None in 60 days"}</p>
          {check.cheapestRecent ? <p className="text-sm text-muted">{label} at {check.cheapestRecent.storeName}, {formatDay(check.cheapestRecent.date)}</p> : null}
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-6">
        {check.offerMinor !== null ? (
          <>
            <Label>A fair offer</Label>
            <p className="mt-1 text-[2rem] leading-tight font-medium tracking-tight">
              {offerInQuote !== null ? formatMoney(offerInQuote, quoteCurrency) : money(check.offerMinor)}
              {offerInQuote !== null ? <span className="text-muted"> ≈ {money(check.offerMinor)}</span> : null}
            </p>
            <p className="text-sm text-muted">Your usual or the cheapest price you found lately, whichever is lower, rounded down.</p>
          </>
        ) : check.verdict === "unknown" ? (
          <p className="text-soft">Buy it once more and Basket will know your usual price.</p>
        ) : (
          <p className="text-soft">{check.verdict === "good" ? "Worth buying: this is under what you normally pay." : "A fair price by your own history."}</p>
        )}
      </div>
    </Panel>
  );
}
