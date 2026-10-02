"use client";

import dynamic from "next/dynamic";
import { DYNAMIC_ENV_ID } from "@/lib/config";

export const walletLinkingEnabled = Boolean(DYNAMIC_ENV_ID);

// The Dynamic SDK touches window at import time, so it never renders on the server.
export const WalletCard = dynamic(() => import("./WalletProvider"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted">Loading wallet options...</p>,
});
