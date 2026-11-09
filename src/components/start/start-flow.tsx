"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "../ui/button";
import { Copy } from "../ui/icons";
import { Spinner } from "../ui/spinner";

type View = { kind: "choose" } | { kind: "created"; key: string } | { kind: "open" };

export function StartFlow() {
  const router = useRouter();
  const keyField = useId();
  const keyError = useId();
  const [view, setView] = useState<View>({ kind: "choose" });
  const [busy, setBusy] = useState<"new" | "open" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);

  async function run(kind: "new" | "open" | "demo") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "new") {
        const { key } = await api.newBasket();
        setView({ kind: "created", key: key! });
      } else if (kind === "open") {
        if (!typed.trim()) throw new ApiError(400, "bad_request", "Paste the basket key, starting with bsk_.");
        await api.openBasket(typed.trim());
        router.push("/basket");
      } else {
        await api.openDemo();
        router.push("/basket");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (view.kind === "created") {
    return (
      <section className="grid gap-6">
        <h1 className="text-title">Your basket is ready</h1>
        <p className="text-soft">This is your basket key. It opens your basket on any device, and it is the only way back in. Keep it somewhere safe, like a password.</p>
        <code className="rounded-sm border border-line bg-surface px-4 py-4 font-mono text-base break-all">{view.key}</code>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(view.key);
                setCopied(true);
              } catch {
                setError("Copying is blocked in this browser. Select the key and copy it by hand.");
              }
            }}
          >
            <Copy className="size-4" />
            {copied ? "Copied" : "Copy the key"}
          </Button>
          <Button onClick={() => router.push("/basket/scan")}>Scan your first receipt</Button>
        </div>
        {error ? <p className="text-sm text-rise">{error}</p> : null}
        <p className="text-sm text-muted">You can see the key again later on the Memory page.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-8">
      <div>
        <h1 className="text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">Start your basket</h1>
        <p className="mt-3 text-soft">No account and no sign-up. Basket gives you a key, and your receipts are remembered on Walrus under it.</p>
      </div>
      <div className="grid gap-3">
        <Button onClick={() => void run("new")} disabled={busy !== null} className="h-12">
          {busy === "new" ? <Spinner label="Creating your basket" /> : null}
          Start a new basket
        </Button>
        <Button variant="secondary" onClick={() => void run("demo")} disabled={busy !== null} className="h-12">
          {busy === "demo" ? <Spinner label="Opening the demo" /> : null}
          See the demo household
        </Button>
      </div>

      {view.kind === "open" ? (
        <form
          noValidate
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run("open");
          }}
        >
          <label htmlFor={keyField} className="text-sm font-medium text-soft">
            Basket key
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id={keyField}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="bsk_…"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? keyError : undefined}
              className="h-12 min-w-0 flex-1 rounded-sm border border-line-strong bg-ground px-4 font-mono text-[15px] placeholder:text-muted focus:border-action focus:outline-none"
            />
            <Button type="submit" variant="secondary" className="h-12" disabled={busy !== null}>
              Open my basket
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-muted">
          Already have a basket?{" "}
          <button type="button" className="text-action underline decoration-action/40 underline-offset-4 hover:decoration-action" onClick={() => setView({ kind: "open" })}>
            Open it with your key
          </button>
        </p>
      )}
      {error ? (
        <p id={keyError} role="alert" className="text-sm text-rise">
          {error}
        </p>
      ) : null}
    </section>
  );
}
