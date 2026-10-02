import { artifacts, network } from "hardhat";
import type { Hex } from "viem";

// Sends a deployment and polls for the receipt, because public RPCs can lag behind a transaction they just accepted.
export async function deploy(name: string) {
  const { viem, networkName } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();
  const { abi, bytecode } = await artifacts.readArtifact(name);
  console.log(`deploying ${name} to ${networkName} from ${wallet.account.address}`);
  const hash = await wallet.deployContract({ abi, bytecode: bytecode as Hex });
  for (let attempt = 0; ; attempt++) {
    const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null);
    if (receipt) {
      if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`deployment failed: ${hash}`);
      return { address: receipt.contractAddress, hash, block: Number(receipt.blockNumber), chainId: await publicClient.getChainId() };
    }
    if (attempt > 60) throw new Error(`no receipt for ${hash}`);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}
