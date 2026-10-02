import { stampRegistryAbi } from "@clipright/contracts/abi";
import { createPublicClient, http, parseEventLogs, type Hex, type Log } from "viem";
import { chain, CHAIN_ID, REGISTRY, RPC_URL } from "../config";

export interface OpenedEvent {
  streamId: Hex;
  signer: Hex;
  title: string;
  block: number;
  tx: Hex;
}

export interface StampedEvent {
  streamId: Hex;
  minute: number;
  root: Hex;
  block: number;
  tx: Hex;
}

type Source = "envio-hypersync" | "public-rpc";

// Monad's public RPC caps eth_getLogs at 100 blocks (about 30s of history); Envio HyperSync reads the whole range.
const PUBLIC_SPAN = 100n;
const START = BigInt(process.env.NEXT_PUBLIC_REGISTRY_START_BLOCK || 0);
const HYPERSYNC_TOKEN = process.env.ENVIO_HYPERSYNC_KEY || process.env.ENVIO_API_TOKEN;
const LOG_FIELDS = ["block_number", "log_index", "transaction_hash", "address", "data", "topic0", "topic1", "topic2", "topic3"];

const state = { scannedTo: START - 1n, opened: [] as OpenedEvent[], stamped: [] as StampedEvent[], at: 0, source: "public-rpc" as Source };
let inflight: Promise<void> | null = null;

function useHyperSync() {
  return !!HYPERSYNC_TOKEN && (CHAIN_ID === 10143 || CHAIN_ID === 143);
}

interface HsLog {
  block_number: number;
  log_index: number;
  transaction_hash: Hex;
  address: Hex;
  data: Hex;
  topic0?: Hex | null;
  topic1?: Hex | null;
  topic2?: Hex | null;
  topic3?: Hex | null;
}

async function hyperSyncLogs(from: bigint): Promise<{ logs: Log[]; to: bigint }> {
  const logs: Log[] = [];
  let next = Number(from);
  for (;;) {
    const res = await fetch(`https://${CHAIN_ID}.hypersync.xyz/query`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${HYPERSYNC_TOKEN}` },
      body: JSON.stringify({ from_block: next, logs: [{ address: [REGISTRY] }], field_selection: { log: LOG_FIELDS } }),
    });
    if (!res.ok) throw new Error(`HyperSync ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { data: unknown; next_block: number; archive_height: number };
    const batches = (Array.isArray(body.data) ? body.data : [body.data]) as { logs?: HsLog[] }[];
    for (const b of batches)
      for (const l of b.logs ?? [])
        logs.push({
          address: l.address,
          data: l.data,
          topics: [l.topic0, l.topic1, l.topic2, l.topic3].filter((t): t is Hex => !!t) as [Hex, ...Hex[]],
          blockNumber: BigInt(l.block_number),
          logIndex: l.log_index,
          transactionHash: l.transaction_hash,
        } as Log);
    if (body.next_block <= next || body.next_block >= body.archive_height) return { logs, to: BigInt(body.next_block) - 1n };
    next = body.next_block;
  }
}

async function publicLogs(from: bigint): Promise<{ logs: Log[]; to: bigint }> {
  const client = createPublicClient({ chain, transport: http(RPC_URL) });
  const head = await client.getBlockNumber();
  const span = CHAIN_ID === 31337 ? 1_000_000n : PUBLIC_SPAN;
  if (CHAIN_ID !== 31337 && head - from > 20_000n) from = head - 20_000n;
  const logs: Log[] = [];
  while (from <= head) {
    const to = from + span - 1n > head ? head : from + span - 1n;
    logs.push(...(await client.getLogs({ address: REGISTRY, fromBlock: from, toBlock: to })));
    from = to + 1n;
  }
  return { logs, to: head };
}

async function scan() {
  const source: Source = useHyperSync() ? "envio-hypersync" : "public-rpc";
  const { logs, to } = source === "envio-hypersync" ? await hyperSyncLogs(state.scannedTo + 1n) : await publicLogs(state.scannedTo + 1n);
  for (const l of parseEventLogs({ abi: stampRegistryAbi, logs })) {
    const base = { block: Number(l.blockNumber), tx: l.transactionHash as Hex };
    if (l.eventName === "StreamOpened") state.opened.push({ ...base, streamId: l.args.streamId, signer: l.args.signer, title: l.args.meta });
    if (l.eventName === "Stamped") state.stamped.push({ ...base, streamId: l.args.streamId, minute: l.args.minute, root: l.args.root });
  }
  if (to > state.scannedTo) state.scannedTo = to;
  state.at = Date.now();
  state.source = source;
}

export async function registryEvents() {
  if (!REGISTRY) return { opened: [], stamped: [], source: "none", scannedTo: 0 };
  if (Date.now() - state.at > 3_000) {
    inflight ??= scan().finally(() => (inflight = null));
    await inflight;
  }
  return { opened: state.opened, stamped: state.stamped, source: state.source, scannedTo: Number(state.scannedTo) };
}
