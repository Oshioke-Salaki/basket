import { ImageResponse } from "next/og";
import { formatDay } from "@/domain/dates";
import { formatPercent } from "@/domain/money";
import { decodeShareCard } from "@/domain/share";

export const alt = "A household's own grocery inflation, measured by Basket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ card: string }> }) {
  const card = decodeShareCard((await params).card);
  const headline = card ? formatPercent(card.r) : "Basket";
  const sub = card ? `My grocery inflation since ${formatDay(card.s, { year: true })}, across ${card.n} things I buy, in ${card.c}.` : "Personal inflation from your own receipts.";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1c1c1c", color: "#f1f1ef", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#8fa68e" }} />
          Basket
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 200, lineHeight: 1, letterSpacing: -8, color: card && card.r > 0 ? "#e2a07f" : "#8fa68e" }}>{headline}</div>
          <div style={{ fontSize: 40, marginTop: 24, color: "#c9c9c5", maxWidth: 1000 }}>{sub}</div>
        </div>
        <div style={{ fontSize: 28, color: "#9a9b96" }}>Measured from my own receipts, remembered on Walrus</div>
      </div>
    ),
    size,
  );
}
