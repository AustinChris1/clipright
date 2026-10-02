import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { network } from "hardhat";

const { viem, networkName } = await network.create();
const publicClient = await viem.getPublicClient();
const [relayer] = await viem.getWalletClients();
console.log(`deploying StampRegistry to ${networkName} from ${relayer.account.address}`);

const { contract, deploymentTransaction } = await viem.sendDeploymentTransaction("StampRegistry");
// Public RPCs can lag behind the transaction they just accepted, so retry the lookup.
let receipt;
for (let attempt = 0; !receipt; attempt++) {
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTransaction.hash, timeout: 60_000 });
  } catch (e) {
    if (attempt >= 10) throw e;
    await new Promise((r) => setTimeout(r, 2_000));
  }
}
const chainId = await publicClient.getChainId();
const out = {
  chainId,
  address: contract.address,
  deployTx: deploymentTransaction.hash,
  startBlock: Number(receipt.blockNumber),
};
const dir = resolve(import.meta.dirname, "../deployments");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, `${chainId}.json`), JSON.stringify(out, null, 2) + "\n");
console.log(out);
