import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import type { Hex } from "viem";
import { txUrl } from "@/lib/config";
import { getStream, loadStamps } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export default async function StreamPage(props: PageProps<"/streams/[id]">) {
  const { id } = await props.params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) notFound();
  const meta = await getStream(id as Hex);
  if (!meta) notFound();
  const stamps = await loadStamps(id as Hex);
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Stream record</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{meta.title}</h1>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Stream id</dt>
          <dd className="font-mono text-xs break-all">{meta.streamId}</dd>
        </div>
        <div>
          <dt className="text-muted">Signing key</dt>
          <dd className="font-mono text-xs break-all">{meta.signer}</dd>
        </div>
      </dl>
      <div className="mt-10 overflow-hidden rounded-3xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-normal">Minute</th>
              <th className="hidden px-5 py-3 font-normal sm:table-cell">Root</th>
              <th className="px-5 py-3 font-normal">Stamped</th>
              <th className="px-5 py-3 font-normal">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stamps.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-5 text-muted">
                  No minutes stamped yet.
                </td>
              </tr>
            )}
            {stamps.map((s) => (
              <tr key={s.minute}>
                <td className="px-5 py-3 font-mono">{s.minute}</td>
                <td className="hidden px-5 py-3 font-mono text-xs text-muted sm:table-cell">{s.root.slice(0, 22)}...</td>
                <td className="px-5 py-3">{new Date(s.at * 1000).toLocaleTimeString()}</td>
                <td className="px-5 py-3">
                  {txUrl(s.tx) ? (
                    <a href={txUrl(s.tx)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-line underline-offset-4">
                      block {s.block} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="font-mono text-xs">block {s.block}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
