import { formatDay } from "@/domain/dates";
import type { Finding } from "@/domain/findings";
import { formatMoney, formatPercent } from "@/domain/money";
import type { PriceBasis } from "@/domain/observations";
import { formatSize } from "@/domain/units";
import { ArrowDown, ArrowUp, Equal, Shrink, Sparkle, Store } from "../ui/icons";
import type { Tone } from "../ui/tag";

export function basisLabel(basis: PriceBasis): string {
  switch (basis) {
    case "measure:g":
      return "per 100g";
    case "measure:ml":
      return "per 100ml";
    case "measure:unit":
      return "each";
    case "pack":
      return "per pack";
  }
}

export interface FindingView {
  readonly tone: Tone;
  readonly tag: string;
  readonly sentence: string;
  readonly icon: React.ReactNode;
}

const icon = "size-3.5";

/** Plain words for one finding. Colour never carries the meaning alone. */
export function describeFinding(f: Finding, currency: string): FindingView {
  const money = (minor: number) => formatMoney(Math.round(minor), currency);
  switch (f.kind) {
    case "first_sighting":
      return { tone: "neutral", tag: "First time", sentence: "Basket has not seen this item before. Its price is now remembered.", icon: <Sparkle className={icon} /> };
    case "above_usual":
      return {
        tone: "rise",
        tag: `${formatPercent(f.deltaRatio, { digits: 0 })} over usual`,
        sentence: `You usually pay ${money(f.usual)} ${basisLabel(f.basis)}; this was ${money(f.paid)}. That is ${money(f.differenceMinor)} more on this line, judged on ${f.sampleSize} earlier ${f.sampleSize === 1 ? "purchase" : "purchases"}.`,
        icon: <ArrowUp className={icon} />,
      };
    case "below_usual":
      return {
        tone: "fall",
        tag: `${formatPercent(-f.deltaRatio, { digits: 0, signed: false })} under usual`,
        sentence: `Cheaper than your usual ${money(f.usual)} ${basisLabel(f.basis)}. You saved ${money(-f.differenceMinor)} on this line.`,
        icon: <ArrowDown className={icon} />,
      };
    case "on_usual":
      return { tone: "neutral", tag: "Usual price", sentence: `In line with what you usually pay, ${money(f.usual)} ${basisLabel(f.basis)}.`, icon: <Equal className={icon} /> };
    case "cheaper_elsewhere":
      return {
        tone: "info",
        tag: `Cheaper at ${f.storeName}`,
        sentence: `${f.storeName} charged ${money(f.theirs)} ${basisLabel(f.basis)} on ${formatDay(f.seenOn)}. Buying it there would have saved ${money(f.couldSaveMinor)}.`,
        icon: <Store className={icon} />,
      };
    case "shrinkflation":
      return {
        tone: "rise",
        tag: "Smaller pack",
        sentence: `The pack shrank from ${formatSize(f.before)} to ${formatSize(f.after)} since ${formatDay(f.seenOn)} while the price stayed at ${money(f.packAfterMinor)}. That is a ${formatPercent(f.measureRiseRatio, { digits: 0, signed: false })} rise per gram.`,
        icon: <Shrink className={icon} />,
      };
  }
}
