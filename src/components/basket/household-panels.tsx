"use client";

import QRCode from "qrcode";
import { useEffect, useId, useState } from "react";
import { ApiError } from "@/lib/api";
import { Button } from "../ui/button";
import { Panel, PanelHeader } from "../ui/panel";
import { Spinner } from "../ui/spinner";
import { useBasket } from "./basket-provider";
import { CurrencyPicker } from "./currency-picker";

/** The household's home currency, saved to Walrus Memory. */
export function HomeCurrencyPanel() {
  const { home, setHomeCurrency, readOnly } = useBasket();
  const id = useId();
  const [choice, setChoice] = useState<string | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });
  if (readOnly || !home) return null;
  const value = choice ?? home;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setState({ kind: "saving" });
    try {
      await setHomeCurrency(value);
      setChoice(null);
      setState({ kind: "saved" });
    } catch (error) {
      setState({ kind: "error", message: error instanceof ApiError ? error.message : "The currency could not be saved. Try again." });
    }
  }

  return (
    <Panel>
      <PanelHeader title="Home currency">
        Your spending, inflation and next shop are measured in it. Receipts in other currencies are kept as they were printed and converted at the rate of their day.
      </PanelHeader>
      <form onSubmit={save} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-2">
          <label htmlFor={id} className="text-sm font-medium text-soft">
            Currency
          </label>
          <CurrencyPicker id={id} value={value} onChange={setChoice} />
        </div>
        <Button type="submit" variant="secondary" className="h-12" disabled={state.kind === "saving" || value === home}>
          {state.kind === "saving" ? <Spinner label="Saving" /> : null}
          Save the currency
        </Button>
      </form>
      {state.kind === "saved" ? <p className="mt-2 text-sm text-fall">Saved to Walrus Memory. Everything is now counted in {home}.</p> : null}
      {state.kind === "error" ? <p className="mt-2 text-sm text-rise">{state.message}</p> : null}
    </Panel>
  );
}

/** A QR code that opens this basket on another phone: one household, several shoppers. */
export function BasketQr({ basketKey }: { basketKey: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    const url = `${window.location.origin}/open#${encodeURIComponent(basketKey)}`;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c1c1c", light: "#f1f1ef" } })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [basketKey]);
  if (!svg) return null;
  return (
    <figure className="m-0 grid gap-3">
      <div
        role="img"
        aria-label="QR code that opens this basket on another phone"
        className="size-48 overflow-hidden rounded-md [&>svg]:size-full"
        // The SVG is generated locally by the qrcode library from our own URL.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="max-w-[40ch] text-sm text-muted">Scan it with another phone’s camera to share this basket with your household.</figcaption>
    </figure>
  );
}
