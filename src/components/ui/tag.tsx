import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "rise" | "fall" | "neutral" | "info";

const tones: Record<Tone, string> = {
  rise: "bg-rise/12 text-rise",
  fall: "bg-fall/14 text-fall",
  neutral: "bg-white/[0.06] text-soft",
  info: "bg-store-1/15 text-[#8db8f0]",
};

/** A short state label. Always carries words, so state is never colour alone. */
export function Tag({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-medium whitespace-nowrap", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
