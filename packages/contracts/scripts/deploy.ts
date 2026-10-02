import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deploy } from "./lib/deploy.ts";

const r = await deploy("StampRegistry");
const out = { chainId: r.chainId, address: r.address, deployTx: r.hash, startBlock: r.block };
const dir = resolve(import.meta.dirname, "../deployments");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, `${r.chainId}.json`), JSON.stringify(out, null, 2) + "\n");
console.log(out);
