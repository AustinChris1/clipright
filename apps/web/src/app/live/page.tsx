import type { Metadata } from "next";
import { Studio } from "@/components/live/Studio";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export const metadata: Metadata = { title: "Go live | Clipright" };

export default function LivePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Go live</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Stamp every minute as you stream.</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Your browser fingerprints the sound and picture. Each minute, your passkey signs one short code and Clipright pays the gas to put it on Monad. The video
        never leaves your device.
      </p>
      <div className="mt-10">
        <WalletProvider>
          <Studio />
        </WalletProvider>
      </div>
    </section>
  );
}
