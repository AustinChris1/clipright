import type { Metadata } from "next";
import { TryIt } from "@/components/try/TryIt";

export const metadata: Metadata = { title: "Try it | Clipright" };

export default function TryPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Try it in a minute</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Can someone change what you said?</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Say one sentence. Clipright stamps it on Monad, then cuts a word out of a copy, the way a misleading clip does. Check both and see which one is
        caught.
      </p>
      <div className="mt-10">
        <TryIt />
      </div>
    </section>
  );
}
