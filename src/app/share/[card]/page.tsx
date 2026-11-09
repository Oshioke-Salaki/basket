import type { Metadata } from "next";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { Mark } from "@/components/ui/icons";
import { formatDay } from "@/domain/dates";
import { formatPercent } from "@/domain/money";
import { decodeShareCard } from "@/domain/share";

type Props = { params: Promise<{ card: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = decodeShareCard((await params).card);
  const title = card ? `My grocery inflation: ${formatPercent(card.r)}` : "Basket";
  return { title, description: "Measured from my own receipts with Basket, the receipt price tracker for households." };
}

async function Card({ params }: Props) {
  const card = decodeShareCard((await params).card);
  if (!card) {
    return <p className="text-lead">This share link is not valid.</p>;
  }
  return (
    <>
      <p className="text-label font-medium text-muted">Grocery inflation since {formatDay(card.s, { year: true })}</p>
      <p className={`mt-3 text-[5rem] leading-none font-medium tracking-[-0.04em] sm:text-[8rem] ${card.r > 0 ? "text-rise" : "text-fall"}`}>{formatPercent(card.r)}</p>
      <p className="mt-6 max-w-[52ch] text-lead text-soft">
        across {card.n} things this household buys again and again, weighted by what it spends, in {card.c}.
        {card.u !== null ? ` In US dollars, the same basket moved ${formatPercent(card.u)}.` : ""}
      </p>
      <p className="mt-6 max-w-[52ch] text-muted">Measured from real receipts, not a national average. The receipts stay private on Walrus Memory; only these numbers were shared.</p>
    </>
  );
}

export default function SharePage({ params }: Props) {
  return (
    <main className="mx-auto flex min-h-svh w-[min(100%-48px,880px)] flex-col justify-center gap-12 py-16">
      <a href="/" className="flex items-center gap-2.5 text-lg font-medium tracking-tight">
        <Mark className="text-action" />
        Basket
      </a>
      <section>
        <Suspense fallback={<p className="text-muted">Loading the card</p>}>
          <Card params={params} />
        </Suspense>
      </section>
      <div>
        <a href="/start" className={buttonClass("primary")}>
          Measure your own basket
        </a>
      </div>
    </main>
  );
}
