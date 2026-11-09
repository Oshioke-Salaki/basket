"use client";

import { useMemo } from "react";
import { COMMON_CURRENCIES } from "@/domain/currency";

function names(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" });
  } catch {
    return null;
  }
}

/** Every currency the browser knows, the common ones first, each with its name. */
export function CurrencyPicker({ id, value, onChange, className }: { id: string; value: string; onChange: (code: string) => void; className?: string }) {
  const options = useMemo(() => {
    const display = names();
    const label = (code: string) => `${code} · ${display?.of(code) ?? code}`;
    const all = Intl.supportedValuesOf("currency").filter((c) => !(COMMON_CURRENCIES as readonly string[]).includes(c));
    return { common: COMMON_CURRENCIES.map((c) => ({ code: c, label: label(c) })), rest: all.map((c) => ({ code: c, label: label(c) })) };
  }, []);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? "h-12 rounded-sm border border-line-strong bg-ground px-4 text-ink focus:border-action focus:outline-none"}
    >
      <optgroup label="Common">
        {options.common.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="All currencies">
        {options.rest.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
