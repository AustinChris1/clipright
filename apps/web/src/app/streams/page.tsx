import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { streamListings } from "@/lib/server/listings";

export const metadata: Metadata = { title: "Streams | Clipright" };
export const dynamic = "force-dynamic";

export default async function StreamsPage() {
  const { streams, source } = await streamListings();
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Streams</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Everything on record.</h1>
      <p className="mt-3 max-w-2xl text-muted">Every stream opened on the registry, newest first, read straight from Monad. Each minute is a transaction.</p>
      <p className="mt-2 font-mono text-xs text-muted">event source: {source === "envio-hypersync" ? "Envio HyperSync" : source === "public-rpc" ? "public RPC (recent blocks only)" : "none"}</p>
      <ul className="mt-10 divide-y divide-line rounded-3xl border border-line bg-card">
        {streams.length === 0 && <li className="p-6 text-sm text-muted">Nothing stamped yet. Go live to create the first record.</li>}
        {streams.map((s) => (
          <li key={s.streamId}>
            <Link href={`/streams/${s.streamId}`} className="group flex items-center justify-between gap-4 p-5 transition hover:bg-paper">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.title}</p>
                <p className="truncate font-mono text-xs text-muted">{s.streamId}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm">
                <span className="font-mono tabular">
                  {s.stamps} min{s.stamps === 1 ? "" : "s"}
                </span>
                <span className="hidden font-mono text-xs text-muted sm:inline">block {s.openedBlock}</span>
                {!s.fingerprints && <span className="hidden rounded-full border border-line px-2 py-0.5 text-xs text-muted sm:inline">no fingerprints here</span>}
                <ArrowUpRight size={16} className="text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
