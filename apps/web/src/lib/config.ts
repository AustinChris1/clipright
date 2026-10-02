import { createPublicClient, defineChain, http, type Address } from "viem";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 10143);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.monad.xyz";
export const REGISTRY = (process.env.NEXT_PUBLIC_REGISTRY || "") as Address;
export const LINKS = (process.env.NEXT_PUBLIC_LINKS || "") as Address;
export const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || "";
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER || "https://testnet.monadscan.com";

const CHAIN_NAMES: Record<number, string> = { 143: "Monad", 10143: "Monad Testnet", 31337: "Local devnet" };

export const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAMES[CHAIN_ID] ?? `Chain ${CHAIN_ID}`,
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

export const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

export const txUrl = (hash: string) => (CHAIN_ID === 31337 ? null : `${EXPLORER}/tx/${hash}`);
export const addressUrl = (addr: string) => (CHAIN_ID === 31337 ? null : `${EXPLORER}/address/${addr}`);
