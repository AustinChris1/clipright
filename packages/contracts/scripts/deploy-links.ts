import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deploy } from "./lib/deploy.ts";

// Adds CreatorLinks beside an existing StampRegistry deployment, leaving the registry untouched.
const r = await deploy("CreatorLinks");
const file = resolve(import.meta.dirname, `../deployments/${r.chainId}.json`);
if (!existsSync(file)) throw new Error("deploy StampRegistry on this network first");
const out = { ...JSON.parse(readFileSync(file, "utf8")), links: r.address, linksTx: r.hash, linksStartBlock: r.block };
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(out);
