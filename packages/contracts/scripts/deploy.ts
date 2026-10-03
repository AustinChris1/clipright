import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deploy } from "./lib/deploy.ts";

const r = await deploy("StampRegistry");
const dir = resolve(import.meta.dirname, "../deployments");
const file = resolve(dir, `${r.chainId}.json`);
// A fresh registry keeps the existing CreatorLinks deployment.
const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const out = { ...prev, chainId: r.chainId, address: r.address, deployTx: r.hash, startBlock: r.block };
mkdirSync(dir, { recursive: true });
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(out);
