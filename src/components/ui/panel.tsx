import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/** The one card recipe: surface, hairline, large radius. Never nested. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("min-w-0 rounded-lg border border-line bg-surface p-6 sm:p-8", className)} {...props} />;
}

export function PanelHeader({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-lead font-medium">{title}</h2>
        {children ? <p className="mt-1 max-w-[62ch] text-muted">{children}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

export function Label({ className, ...props }: ComponentProps<"p">) {
  return <p className={cx("text-label font-medium text-muted", className)} {...props} />;
}
