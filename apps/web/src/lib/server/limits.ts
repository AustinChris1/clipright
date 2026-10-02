import { formatEther, parseEther } from "viem";
import { publicClient } from "../config";
import { registryEvents } from "./chainEvents";
import { relayerAddress } from "./relayer";

// Limits come from onchain events, so every serverless instance sees the same counts.
const OPENS_PER_HOUR = Number(process.env.LIMIT_OPENS_PER_HOUR || 20);
const STAMPS_PER_DAY = Number(process.env.LIMIT_STAMPS_PER_DAY || 300);
const MAX_MINUTES = Number(process.env.LIMIT_MAX_MINUTES || 240);
const MIN_BALANCE = parseEther(process.env.LIMIT_MIN_BALANCE_MON || "0.2");

let pace: { secPerBlock: number; at: number } | null = null;

async function blocksIn(seconds: number): Promise<{ head: number; from: number }> {
  const head = Number(await publicClient.getBlockNumber());
  if (!pace || Date.now() - pace.at > 600_000) {
    const span = 2000;
    const [a, b] = await Promise.all([publicClient.getBlock({ blockNumber: BigInt(head - span) }), publicClient.getBlock({ blockNumber: BigInt(head) })]);
    pace = { secPerBlock: Math.max(0.05, Number(b.timestamp - a.timestamp) / span), at: Date.now() };
  }
  return { head, from: head - Math.ceil(seconds / pace.secPerBlock) };
}

async function gasProblem(): Promise<string | null> {
  const balance = await publicClient.getBalance({ address: relayerAddress() });
  return balance < MIN_BALANCE ? `The relayer is low on gas (${formatEther(balance)} MON). Stamping resumes once it is topped up.` : null;
}

export async function openLimit(): Promise<string | null> {
  const gas = await gasProblem();
  if (gas) return gas;
  const [{ opened }, { from }] = await Promise.all([registryEvents(), blocksIn(3600)]);
  if (opened.filter((o) => o.block >= from).length >= OPENS_PER_HOUR)
    return `This demo opens at most ${OPENS_PER_HOUR} streams an hour. Try again shortly.`;
  return null;
}

export async function stampLimit(minute: number): Promise<string | null> {
  if (minute >= MAX_MINUTES) return `Streams on this demo are capped at ${MAX_MINUTES} minutes.`;
  const gas = await gasProblem();
  if (gas) return gas;
  const [{ stamped }, { from }] = await Promise.all([registryEvents(), blocksIn(86_400)]);
  if (stamped.filter((s) => s.block >= from).length >= STAMPS_PER_DAY)
    return `This demo relays at most ${STAMPS_PER_DAY} stamps a day, and today's are used up.`;
  return null;
}

const REVERTS: Record<string, string> = {
  AlreadyStamped: "This minute is already stamped.",
  TooEarly: "This minute has not happened yet; stamps cannot run ahead of real time.",
  BadSignature: "The signature is not from this stream's key.",
  UnknownStream: "This stream is not on the registry.",
  EmptyRoot: "The minute is empty.",
};

// viem keeps the decoded custom error on a nested cause; read it without instanceof, which fails across bundled copies of viem.
function revertName(e: unknown): string | undefined {
  let x = e as { cause?: unknown; data?: { errorName?: unknown } } | undefined;
  for (let i = 0; x && i < 10; i++) {
    if (typeof x.data?.errorName === "string") return x.data.errorName;
    x = x.cause as typeof x;
  }
  return undefined;
}

export function revertMessage(e: unknown): { message: string; status: number } {
  const text = e instanceof Error ? e.message : String(e);
  const decoded = revertName(e);
  const name = decoded && decoded in REVERTS ? decoded : Object.keys(REVERTS).find((k) => text.includes(k));
  if (name) return { message: REVERTS[name], status: name === "AlreadyStamped" ? 409 : name === "TooEarly" ? 425 : 400 };
  return { message: text.split("\n")[0], status: 502 };
}
