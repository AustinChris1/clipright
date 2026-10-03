import { ArrowRight, BadgeCheck, ImageIcon, Scissors } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SecondStrip } from "@/components/check/Verdict";
import { DropCompare } from "@/components/verdict/DropCompare";
import { LiveCheck } from "@/components/verdict/LiveCheck";
import { getVerdict } from "@/lib/server/store";
import { timecode, verdictCopy } from "@/lib/verdictCopy";

const icons = { faithful: BadgeCheck, edited: Scissors, sound: ImageIcon };

export const dynamic = "force-dynamic";

const clipTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;


export async function generateMetadata({ params }: PageProps<"/v/[id]">): Promise<Metadata> {
  const v = await getVerdict((await params).id);
  if (!v) return { title: "Clip not found | Clipright" };
  const c = verdictCopy(v);
  return {
    title: `${c.headline} | Clipright`,
    description: `${timecode(v.offsetSec)} to ${timecode(v.endSec)} into the stream. Checked against the stamped stream on Monad.`,
  };
}

export default async function VerdictPage({ params }: PageProps<"/v/[id]">) {
  const { id } = await params;
  const v = await getVerdict(id);
  if (!v) notFound();
  const c = verdictCopy(v);
  const Icon = icons[c.kind];
  const color = c.tone === "match" ? "text-match" : "text-warn";
  const ring = c.tone === "match" ? "border-match/40 bg-match/5" : "border-warn/40 bg-warn/5";
  const matched = v.seconds.filter((s) => s.audio || s.picture).map((s) => s.s);

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Checked clip</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className={`rounded-3xl border p-6 sm:p-8 ${ring}`}>
          <p className={`inline-flex items-center gap-2 text-sm font-medium ${color}`}>
            <Icon size={18} /> {c.label}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">{c.headline}</h1>
          <p className="mt-4 font-mono text-lg tabular">
            {timecode(v.offsetSec)} <span className="text-muted">to</span> {timecode(v.endSec)}
            <span className="ml-2 text-sm text-muted">into the stream</span>
          </p>
          {v.owner && (
            <p className="mt-2 text-sm text-muted">
              Stamped by{" "}
              <Link href={`/creators/${v.owner}`} className="font-mono text-ink underline decoration-line underline-offset-4">
                {v.owner.slice(0, 6)}...{v.owner.slice(-4)}
              </Link>
            </p>
          )}
          {v.edits.length > 0 && (
            <ul className="mt-5 space-y-2">
              {v.edits.map((e, i) => (
                <li key={i} className="flex items-start gap-2 rounded-2xl border border-warn/40 bg-card px-4 py-3 text-sm">
                  <Scissors size={16} className="mt-0.5 shrink-0 text-warn" />
                  <span>
                    {e.kind === "cut" && `${e.seconds.toFixed(1)} s of the original was cut out at ${clipTime(e.atClipSec)}`}
                    {e.kind === "inserted" && `${clipTime(e.atClipSec)} to ${clipTime(e.atClipSec + e.seconds)} is not from the stream`}
                    {e.kind === "reordered" && `At ${clipTime(e.atClipSec)} the clip jumps back ${e.seconds.toFixed(1)} s`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <SecondStrip seconds={v.seconds} />
          <p className="mt-6 text-xs text-muted">
            Checked {new Date(v.createdAt).toUTCString().replace(" GMT", " UTC")} ·{" "}
            <Link href={`/streams/${v.streamId}`} className="underline decoration-line underline-offset-4">
              stream record
            </Link>
          </p>
        </div>

        <aside className="space-y-4">
          {v.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/jpeg;base64,${v.thumb}`} alt="A frame from the checked clip" className="max-h-80 w-full rounded-2xl border border-line bg-ink object-contain" />
          )}
          <LiveCheck streamId={v.streamId} seconds={matched.length ? matched : v.seconds.map((s) => s.s)} />
          <DropCompare id={v.id} />
        </aside>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/check" className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm text-paper">
          Check a clip yourself <ArrowRight size={15} className="transition group-hover:translate-x-1" />
        </Link>
        <Link href="/try" className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 text-sm hover:border-ink">
          Try it in a minute
        </Link>
      </div>
    </section>
  );
}
