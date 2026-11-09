"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useBasket } from "@/components/basket/basket-provider";
import { ReceiptReport } from "@/components/basket/receipt-report";
import { TextLink } from "@/components/ui/button";

function ReceiptContent() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const { receipts, lastScan } = useBasket();
  const receipt = receipts.find((r) => r.id === id);

  if (!receipt) {
    return (
      <div className="grid gap-3">
        <h1 className="text-title">Receipt not found</h1>
        <p className="text-muted">It is not in this basket. It may belong to another household.</p>
        <TextLink href="/basket/receipts">See all receipts</TextLink>
      </div>
    );
  }
  const fromScan = lastScan?.receipt.id === id ? lastScan : null;
  return (
    <div className="grid gap-6">
      {search.get("duplicate") ? (
        <p role="status" className="rounded-md border border-line bg-surface px-5 py-3 text-soft">
          This receipt was already in your basket, so nothing new was written. Here is how it compared.
        </p>
      ) : null}
      <ReceiptReport receipt={receipt} learned={fromScan?.learned ?? []} isNew={Boolean(search.get("new"))} />
    </div>
  );
}

export function ReceiptView() {
  return (
    <Suspense>
      <ReceiptContent />
    </Suspense>
  );
}
