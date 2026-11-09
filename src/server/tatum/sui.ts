import "server-only";
import * as grpc from "@grpc/grpc-js";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import { config, required } from "../config";
import { AppError } from "../errors";
import { withRetry } from "./throttle";

/** Tatum's Sui mainnet gRPC gateway. Sui's public JSON-RPC is deprecated in favour of gRPC. */
const TATUM_SUI_GRPC = "sui-mainnet-grpc.gateway.tatum.io:443";

export const SUI_COIN = "0x2::sui::SUI";
export const USDC_COIN = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

let client: SuiGrpcClient | null = null;

function sui(): SuiGrpcClient {
  if (client) return client;
  const transport = new GrpcTransport({
    host: TATUM_SUI_GRPC,
    channelCredentials: grpc.credentials.createSsl(),
    meta: { "x-api-key": required("TATUM_API_KEY", "Tatum") },
    timeout: 15_000,
  });
  client = new SuiGrpcClient({ network: "mainnet", transport });
  return client;
}

const retryable = (error: unknown) => {
  const code = (error as { code?: string | number }).code;
  return code === "UNAVAILABLE" || code === "RESOURCE_EXHAUSTED" || code === 14 || code === 8 || code === "DEADLINE_EXCEEDED";
};

async function read<T>(what: string, call: () => Promise<T>): Promise<T> {
  try {
    return await withRetry(call, retryable);
  } catch (error) {
    throw new AppError("upstream_unavailable", `Could not read ${what} from Sui through Tatum.`, { cause: error });
  }
}

export function parseSuiAddress(input: string): string {
  const trimmed = input.trim();
  if (!isValidSuiAddress(trimmed)) throw new AppError("bad_request", "That is not a Sui address. It starts with 0x and has 64 hex characters.");
  return normalizeSuiAddress(trimmed);
}

export interface Holdings {
  readonly address: string;
  /** Raw on-chain amounts: SUI in MIST (9 decimals), USDC in 6 decimals. */
  readonly suiRaw: bigint;
  readonly usdcRaw: bigint;
  readonly otherCoins: number;
}

export async function holdingsOf(address: string): Promise<Holdings> {
  if (config().BASKET_FAKE_SERVICES) return { address, suiRaw: 12_500_000_000n, usdcRaw: 240_000_000n, otherCoins: 1 };
  let cursor: string | null = null;
  let suiRaw = 0n;
  let usdcRaw = 0n;
  let otherCoins = 0;
  for (let page = 0; page < 5; page++) {
    const res = await read("balances", () => sui().listBalances({ owner: address, limit: 50, cursor }));
    for (const b of res.balances) {
      if (normalizeCoin(b.coinType) === normalizeCoin(SUI_COIN)) suiRaw += BigInt(b.balance);
      else if (normalizeCoin(b.coinType) === normalizeCoin(USDC_COIN)) usdcRaw += BigInt(b.balance);
      else if (BigInt(b.balance) > 0n) otherCoins += 1;
    }
    if (!res.hasNextPage) break;
    cursor = res.cursor;
  }
  return { address, suiRaw, usdcRaw, otherCoins };
}

export interface Checkpoint {
  readonly sequence: string;
  readonly timestamp: string | null;
}

/** The latest Sui checkpoint, read when a receipt is committed so its time is anchored on chain. */
export async function latestCheckpoint(): Promise<Checkpoint> {
  if (config().BASKET_FAKE_SERVICES) return { sequence: "200000000", timestamp: new Date().toISOString() };
  const res = await read("the latest checkpoint", async () =>
    (await sui().ledgerService.getCheckpoint({ checkpointId: { oneofKind: undefined }, readMask: { paths: ["sequence_number", "summary.timestamp"] } })).response,
  );
  const cp = res.checkpoint;
  if (!cp?.sequenceNumber) throw new AppError("upstream_unavailable", "Tatum returned a checkpoint without a sequence number.");
  const ts = cp.summary?.timestamp;
  return {
    sequence: cp.sequenceNumber.toString(),
    timestamp: ts ? new Date(Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1e6)).toISOString() : null,
  };
}

export interface ChainObject {
  readonly objectId: string;
  readonly type: string;
  readonly version: string;
  readonly owner: string;
  readonly fields: Record<string, unknown> | null;
}

/** Read an object from Sui mainnet, such as the Walrus Memory account that owns every basket. */
export async function objectOf(objectId: string): Promise<ChainObject> {
  if (config().BASKET_FAKE_SERVICES) return { objectId, type: "0xfake::account::MemWalAccount", version: "1", owner: "Shared", fields: { delegate_keys: [] } };
  const res = await read("the memory account", () => sui().getObject({ objectId, include: { json: true } }));
  const o = res.object;
  return { objectId: o.objectId, type: o.type, version: o.version, owner: describeOwner(o.owner), fields: (o.json as Record<string, unknown> | null) ?? null };
}

function describeOwner(owner: unknown): string {
  const o = owner as { $kind?: string; AddressOwner?: string; ObjectOwner?: string };
  if (o?.$kind === "AddressOwner" && o.AddressOwner) return o.AddressOwner;
  if (o?.$kind === "ObjectOwner" && o.ObjectOwner) return o.ObjectOwner;
  return o?.$kind ?? "Unknown";
}

function normalizeCoin(type: string): string {
  const [address, ...rest] = type.split("::");
  return [normalizeSuiAddress(address!), ...rest].join("::");
}
