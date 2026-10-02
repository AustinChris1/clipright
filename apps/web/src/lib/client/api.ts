import { creatorLinksAbi, stampRegistryAbi } from "@clipright/contracts/abi";
import { recomputeRoot, secondProof, audioDigest, ZERO32, type MinuteFile } from "@clipright/engine";
import type { Hex } from "viem";
import { LINKS, publicClient, REGISTRY } from "../config";
import type { StampReceipt, StreamDetail, StreamListing, StreamMeta } from "../types";
import type { StampingKey } from "./passkey";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `request failed (${res.status})`);
  return body as T;
}

export async function openStream(key: StampingKey, title: string): Promise<StreamMeta> {
  const signer = key.account.address;
  const nonce = await publicClient.readContract({ address: REGISTRY, abi: stampRegistryAbi, functionName: "nonces", args: [signer] });
  const digest = await publicClient.readContract({
    address: REGISTRY,
    abi: stampRegistryAbi,
    functionName: "openDigest",
    args: [signer, nonce, title],
  });
  const sig = await key.account.signMessage({ message: { raw: digest } });
  return json(await fetch("/api/streams", { method: "POST", body: JSON.stringify({ signer, title, sig }) }));
}

export async function stampMinute(key: StampingKey, file: MinuteFile): Promise<StampReceipt> {
  const digest = await publicClient.readContract({
    address: REGISTRY,
    abi: stampRegistryAbi,
    functionName: "stampDigest",
    args: [file.streamId, file.minute, file.root],
  });
  const sig = await key.account.signMessage({ message: { raw: digest } });
  return json(await fetch(`/api/streams/${file.streamId}/minutes`, { method: "POST", body: JSON.stringify({ file, sig }) }));
}

export async function listStreams(): Promise<StreamListing[]> {
  return (await json<{ streams: StreamListing[] }>(await fetch("/api/streams"))).streams;
}

export async function getStream(id: Hex): Promise<StreamDetail & { minutes: MinuteFile[] }> {
  return json(await fetch(`/api/streams/${id}`));
}

export interface MinuteCheck {
  minute: number;
  localRoot: Hex;
  chainRoot: Hex | null;
  stampedAt: number;
  rootMatches: boolean;
  proofSecond: number;
  proofOk: boolean;
}

// Trust nothing from our server: re-hash each minute and ask Monad directly.
export async function verifyOnChain(streamId: Hex, files: MinuteFile[], seconds: number[]): Promise<MinuteCheck[]> {
  const byMinute = new Map<number, number[]>();
  for (const s of seconds) {
    const m = Math.floor(s / 60);
    byMinute.set(m, [...(byMinute.get(m) ?? []), s]);
  }
  const checks: MinuteCheck[] = [];
  for (const [minute, secs] of byMinute) {
    const file = files.find((f) => f.minute === minute);
    if (!file) continue;
    const localRoot = recomputeRoot(file);
    const [chainRoot, at] = await publicClient.readContract({
      address: REGISTRY,
      abi: stampRegistryAbi,
      functionName: "stamps",
      args: [streamId, minute],
    });
    const s = secs[Math.floor(secs.length / 2)];
    const rec = file.seconds[s - minute * 60];
    const { proof } = secondProof(file, s);
    const [proofOk] = await publicClient.readContract({
      address: REGISTRY,
      abi: stampRegistryAbi,
      functionName: "verifySecond",
      args: [streamId, minute, s - minute * 60, audioDigest(rec.a), rec.pf ?? ZERO32, rec.pc ?? ZERO32, proof],
    });
    const empty = /^0x0+$/.test(chainRoot);
    checks.push({
      minute,
      localRoot,
      chainRoot: empty ? null : chainRoot,
      stampedAt: Number(at),
      rootMatches: !empty && chainRoot.toLowerCase() === localRoot.toLowerCase(),
      proofSecond: s,
      proofOk,
    });
  }
  return checks.sort((a, b) => a.minute - b.minute);
}

export interface OnRecord {
  streamId: Hex;
  title: string;
  offsetSec: number;
  stampedAt: number;
  best: boolean;
}

// When the same footage is in several streams, the earliest onchain stamp shows who had it first.
export async function stampTimes(entries: { streamId: Hex; title: string; offsetSec: number; best: boolean }[]): Promise<OnRecord[]> {
  const out = await Promise.all(
    entries.map(async (e) => {
      const [, at] = await publicClient.readContract({
        address: REGISTRY,
        abi: stampRegistryAbi,
        functionName: "stamps",
        args: [e.streamId, Math.floor(Math.max(0, e.offsetSec) / 60)],
      });
      return { ...e, stampedAt: Number(at) };
    }),
  );
  return out.sort((a, b) => (a.stampedAt || Infinity) - (b.stampedAt || Infinity));
}

// The passkey key and the wallet sign the same digest; the relayer pays for the link.
export async function linkWallet(key: StampingKey, owner: Hex, signWithWallet: (digest: Hex) => Promise<Hex>): Promise<{ tx: Hex; block: number }> {
  if (!LINKS) throw new Error("Wallet linking is not deployed on this network");
  const signer = key.account.address;
  const nonce = await publicClient.readContract({ address: LINKS, abi: creatorLinksAbi, functionName: "nonces", args: [signer] });
  const digest = await publicClient.readContract({ address: LINKS, abi: creatorLinksAbi, functionName: "linkDigest", args: [signer, owner, nonce] });
  const ownerSig = await signWithWallet(digest);
  const signerSig = await key.account.signMessage({ message: { raw: digest } });
  return json(await fetch("/api/links", { method: "POST", body: JSON.stringify({ signer, owner, signerSig, ownerSig }) }));
}

export async function ownerOf(signer: Hex): Promise<Hex | null> {
  if (!LINKS) return null;
  const owner = await publicClient.readContract({ address: LINKS, abi: creatorLinksAbi, functionName: "ownerOf", args: [signer] });
  return /^0x0+$/.test(owner) ? null : owner;
}
