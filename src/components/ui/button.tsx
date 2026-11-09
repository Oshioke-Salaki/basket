import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary";

const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-sm px-6 text-base font-medium whitespace-nowrap transition-[background-color,border-color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-action text-action-ink hover:bg-action-hover",
  secondary: "border border-line-strong text-ink hover:border-ink/50 hover:bg-white/[0.03]",
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return cx(base, variants[variant], className);
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function TextLink({ className, children, ...props }: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link className={cx("text-action underline decoration-action/40 underline-offset-4 transition-colors hover:decoration-action", className)} {...props}>
      {children}
    </Link>
  );
}

export function ExternalLink({ className, children, ...props }: ComponentProps<"a">) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className={cx("text-action underline decoration-action/40 underline-offset-4 transition-colors hover:decoration-action", className)}
      {...props}
    >
      {children}
    </a>
  );
}
