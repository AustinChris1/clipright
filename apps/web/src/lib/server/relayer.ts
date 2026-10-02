import { creatorLinksAbi, stampRegistryAbi } from "@clipright/contracts/abi";
import { createWalletClient, http, nonceManager, parseEventLogs, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, LINKS, publicClient, REGISTRY, RPC_URL } from "../config";

function wallet() {
  const key = process.env.RELAYER_KEY as Hex | undefined;
  if (!key) throw new Error("RELAYER_KEY is not set");
  if (!REGISTRY) throw new Error("NEXT_PUBLIC_REGISTRY is not set");
  return createWalletClient({ account: privateKeyToAccount(key, { nonceManager }), chain, transport: http(RPC_URL) });
}

export function relayerAddress() {
  return wallet().account.address;
}

// Monad bills the gas limit, not gas used; the estimate is taken just before sending, so 5% covers drift.
async function send(functionName: "openStream" | "stamp" | "link", args: readonly unknown[]) {
  const client = wallet();
  const target = functionName === "link" ? { address: LINKS, abi: creatorLinksAbi } : { address: REGISTRY, abi: stampRegistryAbi };
  if (!target.address) throw new Error("the creator links contract is not deployed on this network");
  const { request } = await publicClient.simulateContract({
    ...target,
    functionName,
    args: args as never,
    account: client.account,
  } as never);
  const estimate = await publicClient.estimateContractGas({ ...request, account: client.account });
  const hash = await client.writeContract({ ...request, gas: (estimate * 105n) / 100n });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`transaction reverted: ${hash}`);
  return receipt;
}

export async function relayOpen(signer: Hex, title: string, sig: Hex) {
  const receipt = await send("openStream", [signer, title, sig]);
  const [log] = parseEventLogs({ abi: stampRegistryAbi, logs: receipt.logs, eventName: "StreamOpened" });
  return { streamId: log.args.streamId, tx: receipt.transactionHash, block: Number(receipt.blockNumber) };
}

export async function relayStamp(streamId: Hex, minute: number, root: Hex, sig: Hex) {
  const receipt = await send("stamp", [streamId, minute, root, sig]);
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  return { tx: receipt.transactionHash, block: Number(receipt.blockNumber), at: Number(block.timestamp) };
}

export async function onchainSigner(streamId: Hex): Promise<Hex | null> {
  const [signer] = await publicClient.readContract({ address: REGISTRY, abi: stampRegistryAbi, functionName: "streams", args: [streamId] });
  return /^0x0+$/.test(signer) ? null : signer;
}

export async function relayLink(signer: Hex, owner: Hex, signerSig: Hex, ownerSig: Hex) {
  const receipt = await send("link", [signer, owner, signerSig, ownerSig]);
  return { tx: receipt.transactionHash, block: Number(receipt.blockNumber) };
}
