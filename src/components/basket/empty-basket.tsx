"use client";

import { ButtonLink, buttonClass } from "../ui/button";
import { Panel } from "../ui/panel";
import { useBasket } from "./basket-provider";

export function EmptyBasket() {
  const { readOnly } = useBasket();
  return (
    <Panel className="mx-auto max-w-2xl">
      <h1 className="text-title">Your basket is empty</h1>
      <p className="mt-3 max-w-[56ch] text-muted">
        Scan a grocery receipt to start. Basket remembers every price you pay on Walrus Memory, so from the second receipt on it can tell you what rose, what shrank and where it was cheaper.
      </p>
      {readOnly ? (
        <a href="/start" className={buttonClass("primary", "mt-6")}>
          Start your basket
        </a>
      ) : (
        <ButtonLink href="/basket/scan" className="mt-6">
          Scan a receipt
        </ButtonLink>
      )}
    </Panel>
  );
}
