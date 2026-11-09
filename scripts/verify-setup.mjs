/**
 * Checks the live services Basket depends on, without printing any secret.
 * Run: pnpm verify   (reads .env.local)
 */
import * as grpc from "@grpc/grpc-js";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { MemWal } from "@mysten-incubation/memwal";

const env = process.env;
const results = [];
const check = async (name, fn) => {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail, ms: Date.now() - t0 });
    console.log(`PASS  ${name}  ${detail ?? ""}  (${Date.now() - t0} ms)`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ${error?.message ?? error}`);
  }
};
const need = (key) => {
  if (!env[key]?.trim()) throw new Error(`${key} is empty in .env.local`);
  return env[key].trim();
};

await check("Tatum Data API: 1 SUI in USD", async () => {
  const res = await fetch("https://api.tatum.io/v4/data/rate/symbol?symbol=SUI&basePair=USD", { headers: { "x-api-key": need("TATUM_API_KEY") } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const body = await res.json();
  return `value ${body.value} (${body.symbol}/${body.basePair}, ${body.source})`;
});

await check("Tatum Data API: 1 NGN in USD", async () => {
  const res = await fetch("https://api.tatum.io/v4/data/rate/symbol?symbol=NGN&basePair=USD", { headers: { "x-api-key": need("TATUM_API_KEY") } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const body = await res.json();
  return `value ${body.value} (${body.symbol}/${body.basePair}, ${body.source})`;
});

const sui = () =>
  new SuiGrpcClient({
    network: "mainnet",
    transport: new GrpcTransport({ host: "sui-mainnet-grpc.gateway.tatum.io:443", channelCredentials: grpc.credentials.createSsl(), meta: { "x-api-key": need("TATUM_API_KEY") }, timeout: 15000 }),
  });

await check("Tatum Sui gRPC: latest checkpoint", async () => {
  const { response } = await sui().ledgerService.getCheckpoint({ checkpointId: { oneofKind: undefined }, readMask: { paths: ["sequence_number", "summary.timestamp"] } });
  return `#${response.checkpoint?.sequenceNumber}`;
});

await check("Tatum Sui gRPC: Walrus Memory account object", async () => {
  const { object } = await sui().getObject({ objectId: need("MEMWAL_ACCOUNT_ID"), include: { json: true } });
  return `type ${object.type.split("::").slice(1).join("::")}, version ${object.version}`;
});

await check("Tatum Sui gRPC: balances of a known address", async () => {
  const res = await sui().listBalances({ owner: "0x0000000000000000000000000000000000000000000000000000000000000005", limit: 5 });
  return `${res.balances.length} coin types`;
});

let memwal;
await check("Walrus Memory: client and relayer health", async () => {
  memwal = MemWal.create({ key: need("MEMWAL_PRIVATE_KEY"), accountId: need("MEMWAL_ACCOUNT_ID"), serverUrl: env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz" });
  const h = await memwal.health();
  return `relayer ${h.status}${h.version ? ` ${h.version}` : ""}`;
});

await check("Walrus Memory: agent ID (MEMWAL_AGENT_ID for the form)", async () => `${await memwal.getPublicKeyHex()}`);

await check("Walrus Memory: write on mainnet and read it back", async () => {
  const ns = "basket-setup-check";
  const stamp = new Date().toISOString();
  const written = await memwal.rememberAndWait(`Basket setup check written at ${stamp}.`, ns, { timeoutMs: 120000 });
  const { results: hits } = await memwal.recall({ query: "Basket setup check", namespace: ns, limit: 5, sort: "recent" });
  const found = hits.some((h) => h.text.includes(stamp));
  if (!found) throw new Error(`written as blob ${written.blob_id} but not yet returned by recall`);
  return `blob ${written.blob_id}`;
});

const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
