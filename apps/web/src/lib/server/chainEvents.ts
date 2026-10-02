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

// Monad's public RPC caps eth_getLogs at 100 blocks (about 30s of history); Envio HyperRPC does not.
const PUBLIC_SPAN = 100n;
const HYPER_SPAN = 2_000_000n;
const START = BigInt(process.env.NEXT_PUBLIC_REGISTRY_START_BLOCK || 0);

function source() {
  const token = process.env.ENVIO_API_TOKEN;
  if (token && (CHAIN_ID === 10143 || CHAIN_ID === 143))
    return { name: "envio-hyperrpc" as const, url: `https://${CHAIN_ID}.rpc.hypersync.xyz/${token}`, span: HYPER_SPAN };
  return { name: "public-rpc" as const, url: RPC_URL, span: CHAIN_ID === 31337 ? 1_000_000n : PUBLIC_SPAN };
}

const state = { scannedTo: START - 1n, opened: [] as OpenedEvent[], stamped: [] as StampedEvent[], at: 0, source: source().name as string };
let inflight: Promise<void> | null = null;

async function scan() {
  const src = source();
  const client = createPublicClient({ chain, transport: http(src.url) });
  const head = await client.getBlockNumber();
  const logs: Log[] = [];
  let from = state.scannedTo + 1n;
  if (src.name === "public-rpc" && CHAIN_ID !== 31337 && head - from > 20_000n) from = head - 20_000n;
  while (from <= head) {
    const to = from + src.span - 1n > head ? head : from + src.span - 1n;
    logs.push(...(await client.getLogs({ address: REGISTRY, fromBlock: from, toBlock: to })));
    from = to + 1n;
  }
  for (const l of parseEventLogs({ abi: stampRegistryAbi, logs })) {
    const base = { block: Number(l.blockNumber), tx: l.transactionHash as Hex };
    if (l.eventName === "StreamOpened") state.opened.push({ ...base, streamId: l.args.streamId, signer: l.args.signer, title: l.args.meta });
    if (l.eventName === "Stamped") state.stamped.push({ ...base, streamId: l.args.streamId, minute: l.args.minute, root: l.args.root });
  }
  state.scannedTo = head;
  state.at = Date.now();
  state.source = src.name;
}

export async function registryEvents() {
  if (!REGISTRY) return { opened: [], stamped: [], source: "none", scannedTo: 0 };
  if (Date.now() - state.at > 5_000) {
    inflight ??= scan().finally(() => (inflight = null));
    await inflight;
  }
  return { opened: state.opened, stamped: state.stamped, source: state.source, scannedTo: Number(state.scannedTo) };
}
