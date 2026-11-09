"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { buttonClass, ButtonLink } from "../ui/button";
import { cx } from "../ui/cx";
import { Mark } from "../ui/icons";
import { Spinner } from "../ui/spinner";
import { useBasket } from "./basket-provider";
import { MemoryIndicator } from "./memory-indicator";

const NAV = [
  { href: "/basket", label: "Overview" },
  { href: "/basket/items", label: "Items" },
  { href: "/basket/receipts", label: "Receipts" },
  { href: "/basket/memory", label: "Memory" },
] as const;

function isCurrent(pathname: string, href: string) {
  return href === "/basket" ? pathname === "/basket" : pathname.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const { readOnly, isDemo } = useBasket();

  return (
    <div className="min-h-svh pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-ground">
        Skip to content
      </a>
      <header className="fixed inset-x-0 top-0 z-30 h-14 border-b border-line bg-ground md:h-[72px]">
        <div className="mx-auto flex h-full w-[min(100%-48px,1280px)] items-center justify-between gap-6 md:w-[min(100%-160px,1280px)]">
          <a href="/" className="flex items-center gap-2.5 text-lg font-medium tracking-tight" aria-label="Basket home">
            <Mark className="text-action" />
            Basket
          </a>
          <nav aria-label="Basket" className="hidden items-center gap-1 md:flex">
            <Suspense fallback={<TopLinks pathname={null} />}>
              <CurrentTopLinks />
            </Suspense>
          </nav>
          <div className="flex items-center gap-4">
            <MemoryIndicator />
            {readOnly ? (
              <a href="/start" className={buttonClass("primary", "h-10 px-4 md:h-11 md:px-6")}>
                Start your basket
              </a>
            ) : (
              <ButtonLink href="/basket/scan" className="h-10 px-4 md:h-11 md:px-6">
                Scan a receipt
              </ButtonLink>
            )}
          </div>
        </div>
      </header>

      {isDemo ? (
        <div className="fixed inset-x-0 top-14 z-20 border-b border-line bg-inverse text-inverse-ink md:top-[72px]">
          <p className="mx-auto w-[min(100%-48px,1280px)] py-2 text-sm md:w-[min(100%-160px,1280px)]">
            You are looking at the demo household, read from Walrus Memory. It is read-only.
          </p>
        </div>
      ) : null}

      <main id="main" className={cx("mx-auto w-[min(100%-48px,1280px)] pb-24 md:w-[min(100%-160px,1280px)]", isDemo ? "pt-28 md:pt-36" : "pt-20 md:pt-28")}>
        <BasketGate>{children}</BasketGate>
      </main>

      <nav aria-label="Basket" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground pb-[env(safe-area-inset-bottom)] md:hidden">
        <Suspense fallback={<BottomLinks pathname={null} />}>
          <CurrentBottomLinks />
        </Suspense>
      </nav>
    </div>
  );
}

/** The current page is runtime data, so only the links that mark it wait for it. */
function CurrentTopLinks() {
  return <TopLinks pathname={usePathname()} />;
}

function CurrentBottomLinks() {
  return <BottomLinks pathname={usePathname()} />;
}

function TopLinks({ pathname }: { pathname: string | null }) {
  return NAV.map((item) => {
    const current = pathname !== null && isCurrent(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={current ? "page" : undefined}
        className={cx(
          "relative px-3 py-2 text-[15px] font-medium transition-colors",
          current ? "text-ink after:absolute after:inset-x-3 after:-bottom-[17px] after:h-0.5 after:bg-action" : "text-muted hover:text-ink",
        )}
      >
        {item.label}
      </Link>
    );
  });
}

function BottomLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="grid grid-cols-4">
      {NAV.map((item) => {
        const current = pathname !== null && isCurrent(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cx("flex h-16 items-center justify-center text-sm font-medium", current ? "text-ink" : "text-muted")}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Loading, missing-basket and failure states, shared by every basket page. */
function BasketGate({ children }: { children: ReactNode }) {
  const { status, error, reload, receipts } = useBasket();
  const router = useRouter();

  useEffect(() => {
    if (status === "no-basket") router.replace("/start");
  }, [status, router]);

  if (status === "loading" && receipts.length === 0) {
    return (
      <div className="flex min-h-[50svh] flex-col items-start justify-center gap-4" aria-live="polite">
        <Spinner className="size-5 text-action" label="Recalling your basket" />
        <p className="text-lead">Recalling your basket from Walrus Memory</p>
        <p className="max-w-[52ch] text-muted">Every receipt and everything Basket has learned is stored encrypted on Walrus. Reading it back takes a few seconds.</p>
      </div>
    );
  }
  if (status === "no-basket") return null;
  if (status === "error") {
    return (
      <div className="flex min-h-[50svh] flex-col items-start justify-center gap-4" role="alert">
        <p className="text-lead">Your basket could not be recalled</p>
        <p className="max-w-[52ch] text-muted">{error}</p>
        <button type="button" className={buttonClass("secondary")} onClick={() => void reload(true)}>
          Try again
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

