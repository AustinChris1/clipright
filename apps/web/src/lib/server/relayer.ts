import { stampRegistryAbi } from "@clipright/contracts/abi";
import { createWalletClient, http, nonceManager, parseEventLogs, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, publicClient, REGISTRY, RPC_URL } from "../config";

function wallet() {
  const key = process.env.RELAYER_KEY as Hex | undefined;
  if (!key) throw new Error("RELAYER_KEY is not set");
  if (!REGISTRY) throw new Error("NEXT_PUBLIC_REGISTRY is not set");
  return createWalletClient({ account: privateKeyToAccount(key, { nonceManager }), chain, transport: http(RPC_URL) });
}

// Monad bills the gas limit, not gas used, so the limit is the estimate plus a small margin.
async function send(functionName: "openStream" | "stamp", args: readonly unknown[]) {
  const client = wallet();
  const { request } = await publicClient.simulateContract({
    address: REGISTRY,
    abi: stampRegistryAbi,
    functionName,
    args: args as never,
    account: client.account,
  });
  const estimate = await publicClient.estimateContractGas({ ...request, account: client.account });
  const hash = await client.writeContract({ ...request, gas: (estimate * 115n) / 100n });
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
