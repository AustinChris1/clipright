"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider, mergeNetworks } from "@dynamic-labs/sdk-react-core";
import type { ReactNode } from "react";
import type { StampingKey } from "@/lib/client/passkey";
import { LinkWallet } from "./LinkWallet";
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

function WalletProvider({ children }: { children: ReactNode }) {
  if (!DYNAMIC_ENV_ID) return <>{children}</>;
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        // Only the wallet's signature on the link is needed, so skip Dynamic accounts and their email prompts.
        initialAuthenticationMode: "connect-only",
        walletConnectors: [EthereumWalletConnectors],
        overrides: { evmNetworks: (networks) => mergeNetworks([monad], networks) },
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}

// Loaded only in the browser (see WalletCard): the Dynamic SDK reads window while it loads.
export default function WalletLinkCard({ stampingKey }: { stampingKey: StampingKey | null }) {
  return (
    <WalletProvider>
      <LinkWallet stampingKey={stampingKey} />
    </WalletProvider>
  );
}
