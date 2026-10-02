import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listStreams, loadStamps } from "@/lib/server/store";

export const metadata: Metadata = { title: "Streams | Clipright" };
export const dynamic = "force-dynamic";

export default async function StreamsPage() {
  const streams = await Promise.all((await listStreams()).map(async (s) => ({ ...s, stamps: (await loadStamps(s.streamId)).length })));
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Streams</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Everything on record.</h1>
      <p className="mt-3 max-w-2xl text-muted">Every stream stamped through this instance, newest first. Each minute is a transaction on Monad.</p>
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
                <span className="hidden text-muted sm:inline">{new Date(s.openedAt * 1000).toLocaleDateString()}</span>
                <ArrowUpRight size={16} className="text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
