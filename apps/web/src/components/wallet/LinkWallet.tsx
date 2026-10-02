"use client";

import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { ExternalLink, Link2, Loader2, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { linkWallet, ownerOf } from "@/lib/client/api";
import type { StampingKey } from "@/lib/client/passkey";
import { txUrl } from "@/lib/config";

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
const btn = "inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition disabled:opacity-40";

export function LinkWallet({ stampingKey }: { stampingKey: StampingKey | null }) {
  const { primaryWallet, setShowAuthFlow, handleLogOut } = useDynamicContext();
  const [linked, setLinked] = useState<Hex | null>(null);
  const [tx, setTx] = useState<Hex | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stampingKey) return;
    ownerOf(stampingKey.account.address)
      .then(setLinked)
      .catch(() => {});
  }, [stampingKey]);

  const link = async () => {
    if (!stampingKey || !primaryWallet || !isEthereumWallet(primaryWallet)) return;
    setBusy(true);
    setError(null);
    try {
      const client = await primaryWallet.getWalletClient();
      const owner = primaryWallet.address as Hex;
      const r = await linkWallet(stampingKey, owner, (digest) => client.signMessage({ account: client.account, message: { raw: digest } }));
      setLinked(owner);
      setTx(r.tx);
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Linking failed");
    } finally {
      setBusy(false);
    }
  };

  if (!stampingKey) return <p className="text-sm text-muted">Create your stamping key first. Linking is optional.</p>;

  if (linked)
    return (
      <div className="space-y-2 text-sm">
        <p className="inline-flex items-center gap-2 text-match">
          <Link2 size={16} /> Linked to {short(linked)}
        </p>
        <p className="text-muted">Your streams now show on your creator page and in check results.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={`/creators/${linked}`} className="underline decoration-line underline-offset-4">
            Your creator page
          </Link>
          {tx && txUrl(tx) && (
            <a href={txUrl(tx)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-line underline-offset-4">
              link on Monad <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    );

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Optional. Ties your stamps to your Monad wallet, so all your streams sit under one public creator page. Your wallet never pays gas.</p>
      {primaryWallet ? (
        <>
          <p className="font-mono text-xs break-all">{primaryWallet.address}</p>
          <button disabled={busy} onClick={link} className={`${btn} bg-ink text-paper`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Link this wallet
          </button>
          <button onClick={() => handleLogOut()} className="w-full pt-1 text-center text-xs text-muted underline decoration-line underline-offset-4">
            Use a different wallet
          </button>
        </>
      ) : (
        <button onClick={() => setShowAuthFlow(true)} className={`${btn} border border-line`}>
          <Wallet size={16} /> Connect a wallet
        </button>
      )}
      {error && <p className="text-xs text-stamp">{error}</p>}
    </div>
  );
}
