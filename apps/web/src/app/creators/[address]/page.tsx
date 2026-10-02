import { ArrowUpRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import { addressUrl } from "@/lib/config";
import { streamListings } from "@/lib/server/listings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Creator | Clipright" };

export default async function CreatorPage(props: PageProps<"/creators/[address]">) {
  const { address } = await props.params;
  if (!isAddress(address)) notFound();
  const owner = getAddress(address);
  const { streams } = await streamListings();
  const mine = streams.filter((s) => s.owner && s.owner.toLowerCase() === owner.toLowerCase());
  const minutes = mine.reduce((n, s) => n + s.stamps, 0);
  const explorer = addressUrl(owner);
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Creator</p>
      <h1 className="mt-3 break-all font-mono text-2xl font-semibold sm:text-3xl">{owner}</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Streams whose stamping key this wallet has linked onchain. {mine.length} stream{mine.length === 1 ? "" : "s"}, {minutes} minute{minutes === 1 ? "" : "s"} on
        record.
      </p>
      {explorer && (
        <a href={explorer} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm underline decoration-line underline-offset-4">
          View on Monad explorer <ExternalLink size={12} />
        </a>
      )}
      <ul className="mt-10 divide-y divide-line rounded-3xl border border-line bg-card">
        {mine.length === 0 && <li className="p-6 text-sm text-muted">No streams linked to this wallet yet.</li>}
        {mine.map((s) => (
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
                <ArrowUpRight size={16} className="text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
