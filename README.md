# Basket

**A receipt price tracker that measures each household's own inflation.** Photograph a grocery receipt and Basket reads every line, compares each price with what you paid before, and tells you what rose, what shrank and which of your stores was cheaper. Every receipt, and everything Basket learns from it, is stored encrypted on **Walrus Memory on Sui mainnet**, so the app gets sharper with each shop and follows you to any device.

Built for the Tatum × Walrus **Total Recall** hackathon, Track 3: Consumer Finance Apps.

## What it does

| On a receipt | Across your receipts | Through your wallet |
| --- | --- | --- |
| Each line against your usual price (median of recent purchases, compared per 100 g / 100 ml so pack sizes don't hide rises) | Your **personal inflation rate**: every item you buy repeatedly, weighted by what you spend on it, in your currency and in US dollars | **Groceries in weeks**: a Sui wallet's SUI and USDC, read through Tatum, expressed as weeks of *your* groceries |
| **Shrinkflation**: a smaller pack at the same price, flagged with the rise per gram | The items driving it, ranked by weight | |
| **Cheaper elsewhere**: the same item at one of your own stores in the last 60 days | Your stores ranked on the items you share | |

A **With memory / Without memory** switch on every receipt replays it with no history: the gap between the two views is what memory buys.

## How it uses Walrus Memory

Memory is the product, not a log. Each household gets two namespaces under one Walrus Memory account:

- **`…-receipts`**: one memory per receipt. Each is a plain-language note (readable in the Walrus Memory dashboard) followed by one tagged line Basket decodes exactly.
- **`…-lessons`**: what Basket concluded. A lesson has a stable key (`usual_price:mama-gold-rice`) and a signature. It is written when a belief first forms and **again only when it changes**, so the namespace reads as a history of what the app came to believe and when. Kinds: usual price, cheapest store, shrinkflation, purchase cadence, best store, monthly inflation, and **same item** (a household correction).

The learning loop, on every scan:

1. **Recall** both namespaces (`recall`, `sort: "recent"`, up to 100 per call).
2. **Memory steers extraction.** The household's known items go into the receipt reader's prompt, so `PEAK MLK 400G` lands on the key their history already uses (`peak-evaporated-milk`). Without that, the second receipt would have nothing to compare against.
3. **Judge** the receipt against everything earlier in time.
4. **Learn**: re-derive beliefs, keep only those that are new or changed.
5. **Write** the receipt and the new lessons in **one `rememberBulk` call**, which also respects the relayer's 30 requests/min budget.
6. **Corrections persist.** "These two names are one product" is stored as a `same_item` lesson and applied to every past and future receipt.

There is no database. Each visit recalls the basket from Walrus. A short per-process cache bridges the seconds before a new write becomes searchable. Open the same **basket key** on another phone and everything comes back.

## How it uses Tatum

All chain reads go through **Tatum's Sui mainnet gRPC gateway** (`sui-mainnet-grpc.gateway.tatum.io`, via `@mysten/sui`'s `SuiGrpcClient` over native gRPC). Sui's public JSON-RPC is deprecated.

| Call | Where |
| --- | --- |
| `StateService.ListBalances` | Groceries in weeks: the wallet's SUI and USDC |
| `LedgerService.GetCheckpoint` | Every receipt is stamped with the Sui checkpoint at the moment it was committed |
| `StateService.GetObject` | The Memory page reads the Walrus Memory account object live, as proof of where the basket lives |
| **Data API** `/v4/data/rate/symbol` | Fiat and SUI rates: each receipt records its USD value, which powers inflation in dollars and the wallet runway |

Every Tatum call shares one throttle (350 ms spacing) and retries on 429/UNAVAILABLE, so the free plan's 3 requests/second is never exceeded.

## Architecture

```
src/
  domain/      Pure, tested logic: money, units, receipts, baselines, findings,
               inflation index, stores, spend, lessons, ledger. No I/O; runs on server and client.
  server/      config (zod-validated env), errors, session (basket keys), http helpers
    memory/    Walrus Memory: client, codec, repository (bulk writes, recall, job status), cache
    tatum/     throttle, Data API rates, Sui gRPC (balances, checkpoint, objects)
    vision/    Claude receipt reader: structured outputs, prompt with known items, fakes for tests
    services/  scan, merge, runway, proof: the use cases the routes call
  app/
    api/       Route handlers, each wrapped so failures leave as { error: { code, message } }
    basket/    The app: overview, scan, receipts, items, memory
    start/     New basket, open with key, demo
  components/  UI primitives, charts (validated palette, table views), basket views
public/
  landing.html The landing page, built with the taste-skill design kit (public/assets)
```

- **Identity without accounts:** a basket key (`bsk_…`, 128 random bits) lives in an HttpOnly cookie. Namespaces are derived from a hash of the key, so the key itself never reaches Walrus.
- **Receipt reading:** `claude-opus-5-5` with structured outputs (`messages.parse` + Zod schema). Every value is then validated and normalised server-side: minor units, ISO currency, no future dates, canonical keys, plausible totals. Photos are downscaled in the browser and sniffed by magic bytes on the server.
- **Money** is always integer minor units with an ISO 4217 code. Floats appear only in derived ratios.

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in the keys below
pnpm dev
```

| Variable | Where to get it |
| --- | --- |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `TATUM_API_KEY` | dashboard.tatum.io (the free plan is enough) |
| `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY` | memory.walrus.xyz/dashboard: create the account, add a delegate key. The managed relayer pays gas and storage. |
| `BASKET_DEMO_KEY` | optional: the basket key of a household to show read-only at `/demo` |

## Tests

```bash
pnpm check        # typecheck, lint, 39 unit tests (domain, codec, repository on MemWalMock, receipt normalisation, sessions)
pnpm test:e2e     # Playwright on desktop and phone against in-process fakes of Walrus, Tatum and Claude
```

The end-to-end suite walks the real journey: start a basket, scan three receipts at two stores, watch rises, a cheaper store and a smaller pack appear, switch memory off and on, merge two item names, read a wallet, open the memory proof.

## Limits

- Basket only knows what your receipts tell it. Inflation needs the same item bought twice, at least 7 days apart.
- Recall returns at most 100 memories per namespace, so a basket keeps its newest 100 receipts in view.
- The basket key is the only way back in. There is no reset link.
- The managed relayer sees plaintext while it encrypts and embeds. That is Walrus Memory's documented trust model for the hosted relayer.
