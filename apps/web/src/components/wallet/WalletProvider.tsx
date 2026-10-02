"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider, mergeNetworks } from "@dynamic-labs/sdk-react-core";
import type { ReactNode } from "react";
import { chain, CHAIN_ID, DYNAMIC_ENV_ID, EXPLORER, RPC_URL } from "@/lib/config";

// Monad Testnet may not be enabled in the dashboard, so the SDK is told about it directly.
const monad = {
  blockExplorerUrls: [EXPLORER],
  chainId: CHAIN_ID,
  chainName: chain.name,
  iconUrls: ["https://clipright.vercel.app/icon.svg"],
  name: chain.name,
  nativeCurrency: { decimals: 18, name: "MON", symbol: "MON" },
  networkId: CHAIN_ID,
  rpcUrls: [RPC_URL],
  vanityName: chain.name,
};

export const walletLinkingEnabled = Boolean(DYNAMIC_ENV_ID);

export function WalletProvider({ children }: { children: ReactNode }) {
  if (!walletLinkingEnabled) return <>{children}</>;
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
        overrides: { evmNetworks: (networks) => mergeNetworks([monad], networks) },
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
