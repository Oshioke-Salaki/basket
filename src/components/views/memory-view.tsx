"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useBasket, type MemoryJob } from "@/components/basket/basket-provider";
import { LessonsList } from "@/components/basket/lessons-list";
import { Button, ExternalLink } from "@/components/ui/button";
import { Copy } from "@/components/ui/icons";
import { Label, Panel, PanelHeader } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import { currentLessons } from "@/domain/lessons";
import { api, ApiError } from "@/lib/api";
import type { ProofPayload } from "@/lib/api-types";
import { shortId, suiCheckpointUrl, suiObjectUrl, walrusBlobUrl } from "@/lib/links";

export function MemoryView() {
  const { receipts, lessons, jobs, readOnly, degraded } = useBasket();
  const beliefs = useMemo(() => currentLessons(lessons), [lessons]);
  const writes = Object.values(jobs).sort((a, b) => b.startedAt - a.startedAt);

  return (
    <div className="grid gap-6">
      <header className="mb-2">
        <h1 className="text-title sm:text-[2.5rem] sm:leading-[1.1] sm:tracking-[-0.025em]">Memory</h1>
        <p className="mt-2 max-w-[62ch] text-muted">
          Everything Basket knows about this household lives in Walrus Memory on mainnet, encrypted with Seal. Nothing is kept in a database of ours: open the same basket key on another phone and it all comes back.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-3">
        <Stat label="Memories on Walrus" value={receipts.length + lessons.length} note={`${receipts.length} receipts and ${lessons.length} lessons`} />
        <Stat label="Current beliefs" value={beliefs.length} note="the newest lesson for each thing learned" />
        <Stat label="Lessons revised" value={lessons.length - beliefs.length} note="beliefs Basket updated as prices moved" />
      </div>
      {degraded ? (
        <p role="status" className="rounded-md border border-rise/40 bg-rise/10 px-5 py-3 text-soft">
          Some memories could not be decrypted on this recall. They are still on Walrus and will return on the next one.
        </p>
      ) : null}

      {writes.length > 0 ? <WritesPanel writes={writes} /> : null}

      <Panel>
        <PanelHeader title="What Basket believes now">Each belief was learned from your receipts and written to Walrus when it first formed or changed.</PanelHeader>
        {beliefs.length ? <LessonsList lessons={beliefs} /> : <p className="text-muted">Nothing yet. Lessons form once an item has been bought twice.</p>}
      </Panel>

      <ProofPanel />
      {readOnly ? null : <KeyPanel />}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Panel>
      <Label>{label}</Label>
      <p className="mt-1 text-[2.25rem] leading-tight font-medium tracking-tight">{value}</p>
      <p className="text-sm text-muted">{note}</p>
    </Panel>
  );
}

const STATE_WORDS: Record<MemoryJob["state"], string> = {
  pending: "Queued",
  running: "Encrypting and uploading",
  uploaded: "Uploaded, registering on Sui",
  done: "Stored",
  failed: "Failed",
  not_found: "Not found",
  slow: "Still confirming",
};

function WritesPanel({ writes }: { writes: readonly MemoryJob[] }) {
  return (
    <Panel>
      <PanelHeader title="Writes this session">Each memory is embedded, encrypted, uploaded to Walrus and registered on Sui by the relayer.</PanelHeader>
      <ul>
        {writes.map((w) => (
          <li key={w.jobId} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
            <span className="text-soft">{w.receiptId ? "Receipt" : "Lesson"}</span>
            <span className="flex items-center gap-2 text-sm text-muted">
              {w.state === "done" && w.blobId ? (
                <>
                  Blob <ExternalLink href={walrusBlobUrl(w.blobId)}>{shortId(w.blobId, 8, 6)}</ExternalLink>
                </>
              ) : (
                <>
                  {w.state === "pending" || w.state === "running" || w.state === "uploaded" ? <Spinner className="size-3.5 text-action" label={STATE_WORDS[w.state]} /> : null}
                  {STATE_WORDS[w.state]}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ProofPanel() {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "done"; proof: ProofPayload } | { kind: "error"; message: string }>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    api
      .proof()
      .then((proof) => live && setState({ kind: "done", proof }))
      .catch((e) => live && setState({ kind: "error", message: e instanceof ApiError ? e.message : "Sui could not be reached." }));
    return () => {
      live = false;
    };
  }, []);

  return (
    <Panel>
      <PanelHeader title="Where it lives on Sui">Read live from Sui mainnet through Tatum’s gRPC gateway each time this page opens.</PanelHeader>
      {state.kind === "loading" ? (
        <p className="flex items-center gap-2 text-muted">
          <Spinner className="text-action" label="Reading Sui" /> Reading Sui mainnet
        </p>
      ) : state.kind === "error" ? (
        <p className="text-rise">{state.message}</p>
      ) : (
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Fact term="Memory account">
            <ExternalLink href={suiObjectUrl(state.proof.account.objectId)}>{shortId(state.proof.account.objectId, 10, 6)}</ExternalLink>
            <span className="block text-sm text-muted">version {state.proof.account.version}</span>
          </Fact>
          <Fact term="Latest checkpoint">
            <ExternalLink href={suiCheckpointUrl(state.proof.checkpoint.sequence)}>{Number(state.proof.checkpoint.sequence).toLocaleString("en")}</ExternalLink>
            {state.proof.checkpoint.timestamp ? <span className="block text-sm text-muted">{new Date(state.proof.checkpoint.timestamp).toLocaleString("en")}</span> : null}
          </Fact>
          <Fact term="Receipts namespace">
            <span className="font-mono text-[13px] break-all text-soft">{state.proof.namespaces.receipts}</span>
          </Fact>
          <Fact term="Lessons namespace">
            <span className="font-mono text-[13px] break-all text-soft">{state.proof.namespaces.lessons}</span>
          </Fact>
        </dl>
      )}
    </Panel>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label font-medium text-muted">{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function KeyPanel() {
  const router = useRouter();
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    try {
      setKey((await api.basketKey()).key);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The key could not be shown.");
    }
  }

  async function copy() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying is blocked in this browser. Select the key and copy it by hand.");
    }
  }

  async function close() {
    await api.closeBasket();
    router.replace("/start");
  }

  return (
    <Panel>
      <PanelHeader title="Your basket key">
        The key opens this basket on any device. Anyone who has it can read your receipts, so keep it like a password. There is no other way to recover the basket.
      </PanelHeader>
      {key ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="rounded-sm border border-line bg-ground px-4 py-3 font-mono text-[15px] break-all">{key}</code>
          <Button variant="secondary" onClick={() => void copy()}>
            <Copy className="size-4" />
            {copied ? "Copied" : "Copy the key"}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => void reveal()}>
          Show the key
        </Button>
      )}
      {error ? <p className="mt-2 text-sm text-rise">{error}</p> : null}
      <p className="mt-6 text-sm text-muted">
        Done on this device?{" "}
        <button type="button" onClick={() => void close()} className="text-action underline decoration-action/40 underline-offset-4 hover:decoration-action">
          Close the basket here
        </button>
        . Your memories stay on Walrus.
      </p>
    </Panel>
  );
}
