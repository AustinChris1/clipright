import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../.env"));
} catch {}

const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || "10143";
const deployment = resolve(import.meta.dirname, `../../packages/contracts/deployments/${chainId}.json`);
const deployed = existsSync(deployment) ? JSON.parse(readFileSync(deployment, "utf8")) : null;
const registry = process.env.NEXT_PUBLIC_REGISTRY || deployed?.address || "";
const startBlock = process.env.NEXT_PUBLIC_REGISTRY_START_BLOCK || String(deployed?.startBlock ?? 0);

const nextConfig: NextConfig = {
  transpilePackages: ["@clipright/engine", "@clipright/contracts"],
  env: {
    NEXT_PUBLIC_CHAIN_ID: chainId,
    NEXT_PUBLIC_REGISTRY: registry,
    NEXT_PUBLIC_REGISTRY_START_BLOCK: startBlock,
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || (chainId === "31337" ? "http://127.0.0.1:8545" : "https://testnet-rpc.monad.xyz"),
    NEXT_PUBLIC_EXPLORER: process.env.NEXT_PUBLIC_EXPLORER || "https://testnet.monadscan.com",
  },
};

export default nextConfig;
