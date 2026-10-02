import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { network } from "hardhat";

const { viem, networkName } = await network.create();
const publicClient = await viem.getPublicClient();
const [relayer] = await viem.getWalletClients();
console.log(`deploying StampRegistry to ${networkName} from ${relayer.account.address}`);

const { contract, deploymentTransaction } = await viem.sendDeploymentTransaction("StampRegistry");
const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTransaction.hash });
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
