"use client";

import { useId, useMemo, useState } from "react";
import { knownItems } from "@/domain/ledger";
import { toMajor, toMinor } from "@/domain/money";
import type { ReceiptLine } from "@/domain/receipt";
import type { LineRevision } from "@/domain/revise";
import { normalizeSize } from "@/domain/units";
import { ApiError } from "@/lib/api";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { useBasket } from "./basket-provider";

const UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
const field = "h-12 w-full rounded-sm border border-line-strong bg-ground px-4 text-ink placeholder:text-muted focus:border-action focus:outline-none";

/** Correct one line the reader got wrong. The fix is saved to Walrus as a new version of the receipt. */
export function LineEditor({ receiptId, lineIndex, line, currency, onDone }: { receiptId: string; lineIndex: number; line: ReceiptLine; currency: string; onDone: () => void }) {
  const { receipts, lessons, revise } = useBasket();
  const ids = { name: useId(), price: useId(), qty: useId(), amount: useId(), unit: useId(), list: useId(), error: useId() };
  const known = useMemo(() => knownItems({ receipts, lessons }, 500), [receipts, lessons]);
  const [name, setName] = useState(line.itemName);
  const [price, setPrice] = useState(String(toMajor(line.totalMinor, currency)));
  const [qty, setQty] = useState(String(line.quantity));
  const [amount, setAmount] = useState(line.size ? String(line.size.unit === "g" && line.size.amount >= 1000 ? line.size.amount / 1000 : line.size.unit === "ml" && line.size.amount >= 1000 ? line.size.amount / 1000 : line.size.amount) : "");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>(line.size ? (line.size.unit === "unit" ? "pcs" : line.size.amount >= 1000 ? (line.size.unit === "g" ? "kg" : "l") : line.size.unit) : "g");
  const [state, setState] = useState<{ kind: "idle" | "saving" } | { kind: "error"; message: string }>({ kind: "idle" });

  async function send(revision: LineRevision) {
    setState({ kind: "saving" });
    try {
      await revise(receiptId, revision);
      onDone();
    } catch (error) {
      setState({ kind: "error", message: error instanceof ApiError ? error.message : "The correction could not be saved. Try again." });
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const total = Number(price.replace(/,/g, ""));
    const quantity = Number(qty);
    if (!name.trim()) return setState({ kind: "error", message: "Write the item's name." });
    if (!(total > 0)) return setState({ kind: "error", message: "Write the price paid for the whole line, more than zero." });
    if (!(quantity > 0)) return setState({ kind: "error", message: "Write how many were bought, 1 or more." });
    const size = amount.trim() ? normalizeSize(Number(amount), unit) : null;
    if (amount.trim() && !size) return setState({ kind: "error", message: "Write the pack size as a number, or leave it empty." });
    const match = known.find((k) => k.itemName.toLowerCase() === name.trim().toLowerCase());
    void send({ action: "update", lineIndex, itemName: match?.itemName ?? name.trim(), itemKey: match?.itemKey ?? null, totalMinor: toMinor(total, currency), quantity, size });
  }

  return (
    <form onSubmit={save} noValidate className="mt-3 grid gap-4 rounded-md border border-line bg-ground/60 p-4">
      <div className="grid gap-2">
        <label htmlFor={ids.name} className="text-sm font-medium text-soft">
          Item
        </label>
        <input id={ids.name} list={ids.list} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={field} />
        <datalist id={ids.list}>
          {known.map((k) => (
            <option key={k.itemKey} value={k.itemName} />
          ))}
        </datalist>
        <p className="text-sm text-muted">Pick one of your items to join this line to its history.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div className="grid gap-2">
          <label htmlFor={ids.price} className="text-sm font-medium text-soft">
            Paid for the line ({currency})
          </label>
          <input id={ids.price} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={field} />
        </div>
        <div className="grid gap-2">
          <label htmlFor={ids.qty} className="text-sm font-medium text-soft">
            Quantity
          </label>
          <input id={ids.qty} value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={field} />
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium text-soft" id={`${ids.amount}-label`}>
          Pack size, if printed
        </span>
        <div className="flex gap-3">
          <input id={ids.amount} aria-labelledby={`${ids.amount}-label`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="None" className={`${field} w-32`} />
          <label htmlFor={ids.unit} className="sr-only">
            Size unit
          </label>
          <select id={ids.unit} value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])} className={`${field} w-28`}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state.kind === "error" ? (
        <p id={ids.error} role="alert" className="text-sm text-rise">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={state.kind === "saving"}>
          {state.kind === "saving" ? <Spinner label="Saving the correction" /> : null}
          Save the correction
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={state.kind === "saving"}>
          Cancel
        </Button>
        <button
          type="button"
          disabled={state.kind === "saving"}
          onClick={() => void send({ action: "remove", lineIndex })}
          className="min-h-11 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-rise sm:ml-auto"
        >
          Not an item: remove this line
        </button>
      </div>
    </form>
  );
}
