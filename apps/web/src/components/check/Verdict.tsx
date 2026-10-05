"use client";

import type { CheckResult, SecondVerdict } from "@clipright/engine";
import type { Hex } from "viem";
import { BadgeCheck, CircleSlash, Clock, ExternalLink, ImageIcon, Info, Link2, Radio, Scissors } from "lucide-react";
import { motion } from "motion/react";
import type { MinuteCheck, OnRecord } from "@/lib/client/api";
import { txUrl } from "@/lib/config";
import { timecode } from "@/lib/verdictCopy";
import type { StreamMeta } from "@/lib/types";

function clipTime(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec - m * 60)).padStart(2, "0")}`;
}

export { timecode };

const tone = {
  edited: { label: "Edited from a stamped stream", icon: Scissors, cls: "text-warn", ring: "border-warn/40 bg-warn/5" },
  match: { label: "Match", icon: BadgeCheck, cls: "text-match", ring: "border-match/40 bg-match/5" },
  "picture-only": { label: "Pictures match, sound does not", icon: ImageIcon, cls: "text-warn", ring: "border-warn/40 bg-warn/5" },
  "no-match": { label: "No match", icon: CircleSlash, cls: "text-stamp", ring: "border-stamp/40 bg-stamp/5" },
} as const;

export function Verdict({
  result,
  stream,
  chain,
  clipUrl,
  duration,
  onRecord,
  hasVideo,
  streamsChecked,
  minutesChecked,
  owner,
}: {
  result: CheckResult;
  stream: StreamMeta | null;
  chain: MinuteCheck[];
  clipUrl: string;
  duration: number;
  onRecord: OnRecord[];
  hasVideo: boolean;
  streamsChecked: number;
  minutesChecked: number;
  owner: Hex | null;
}) {
  const edited = result.status === "match" && result.edits.length > 0;
  const t = edited ? tone.edited : tone[result.status];
  const Icon = t.icon;
  const soundOk = result.seconds.filter((s) => s.audio).length;
  const pictureOk = result.seconds.filter((s) => s.picture).length;
  const bits = result.seconds.map((s) => s.pictureBits).filter((b): b is number => b !== null);
  const allChainOk = chain.length > 0 && chain.every((c) => c.rootMatches && c.proofOk);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className={`rounded-3xl border p-6 sm:p-8 ${t.ring}`}>
        <div className={`inline-flex items-center gap-2 text-sm font-medium ${t.cls}`}>
          <Icon size={18} /> {t.label}
        </div>
        {result.status === "no-match" ? (
          <>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">No Clipright record.</h2>
            <p className="mt-2 text-lg">That doesn&apos;t make it fake. It just wasn&apos;t stamped while it aired.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5">
                <Radio size={14} className="text-muted" /> {streamsChecked} stream{streamsChecked === 1 ? "" : "s"} checked
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5">
                <Clock size={14} className="text-muted" /> {minutesChecked} minute{minutesChecked === 1 ? "" : "s"} on record
              </span>
            </div>
            <p className="mt-4 inline-flex items-start gap-2 text-sm text-muted">
              <Info size={15} className="mt-0.5 shrink-0" /> Only streams stamped live can match, so TV, films and unstamped streams never will.
            </p>
            <a href="/docs/test-it#clips" className="mt-3 block text-sm text-ink underline decoration-line underline-offset-4">
              Try a clip that is on record
            </a>
          </>
        ) : (
          <>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              From <span className="underline decoration-line underline-offset-8">{stream?.title ?? "a stamped stream"}</span>
            </h2>
            {owner && (
              <p className="mt-2 text-sm text-muted">
                Stamped by{" "}
                <a href={`/creators/${owner}`} className="font-mono text-ink underline decoration-line underline-offset-4">
                  {owner.slice(0, 6)}...{owner.slice(-4)}
                </a>
                , a wallet linked onchain to this stream&apos;s key
              </p>
            )}
            <p className="mt-3 font-mono text-lg tabular">
              {timecode(result.offsetSec!)} <span className="text-muted">to</span>{" "}
              {timecode(result.segments.length ? Math.max(...result.segments.map((g) => g.offsetSec + g.clipEnd)) : result.offsetSec! + duration)}
              <span className="ml-2 text-sm text-muted">into the stream</span>
            </p>
            {result.status === "picture-only" && (
              <p className="mt-3 max-w-xl text-muted">
                The pictures line up with this stream, but the sound does not. The soundtrack was replaced or altered, so the exact second is approximate.
              </p>
            )}
            {edited && (
              <ul className="mt-4 space-y-2">
                {result.edits.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-2xl border border-warn/40 bg-card px-4 py-3 text-sm">
                    <Scissors size={16} className="mt-0.5 shrink-0 text-warn" />
                    <span>
                      {e.kind === "cut" && (
                        <>
                          <strong>{e.seconds.toFixed(1)} s of the original was cut out</strong> at {clipTime(e.atClipSec)} in the clip. The words around it were
                          said, just not next to each other.
                        </>
                      )}
                      {e.kind === "inserted" && (
                        <>
                          <strong>{clipTime(e.atClipSec)} to {clipTime(e.atClipSec + e.seconds)} of the clip is not from the stream.</strong> Something else
                          was put in.
                        </>
                      )}
                      {e.kind === "reordered" && (
                        <>
                          <strong>At {clipTime(e.atClipSec)} the clip jumps back {e.seconds.toFixed(1)} s</strong> in the stream, so parts are out of order.
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <SecondStrip seconds={result.seconds} />
            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              <Evidence label="Sound" value={result.audio ? `${result.audio.hits} fingerprints aligned` : "no match"} sub={`${soundOk} of ${result.seconds.length} seconds`} />
              <Evidence
                label="Picture"
                value={hasVideo ? `${pictureOk} of ${result.seconds.length} seconds` : "not checked"}
                sub={!hasVideo ? "audio-only file" : bits.length ? `${Math.min(...bits)} to ${Math.max(...bits)} of 256 bits apart` : "no usable frames"}
              />
              <Evidence label="Record" value={chain.length ? `${chain.filter((c) => c.rootMatches).length} of ${chain.length} minute${chain.length === 1 ? "" : "s"}` : "not checked"} sub="re-hashed here, compared on Monad" />
            </dl>
            {onRecord.length > 1 && (
              <div className="mt-8">
                <p className="font-mono text-xs uppercase tracking-wider text-muted">Same footage is on record in {onRecord.length} streams</p>
                <ol className="mt-2 divide-y divide-line rounded-2xl border border-line bg-card/70">
                  {onRecord.map((r, i) => (
                    <li key={r.streamId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0 truncate">
                        {r.title} <span className="font-mono text-xs text-muted">at {timecode(r.offsetSec)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        {r.stampedAt > 0 && <span className="text-muted">{new Date(r.stampedAt * 1000).toLocaleString()}</span>}
                        {i === 0 && <span className="rounded-full bg-match px-2 py-0.5 text-white">stamped first</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>

      <aside className="space-y-4">
        {hasVideo ? (
          <video src={clipUrl} controls muted playsInline className="aspect-[9/16] max-h-80 w-full rounded-2xl border border-line bg-ink object-contain" />
        ) : (
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="mb-2 text-xs text-muted">Audio-only file</p>
            <audio src={clipUrl} controls className="w-full" />
          </div>
        )}
        {chain.length > 0 && (
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className={`flex items-center gap-2 text-sm font-medium ${allChainOk ? "text-match" : "text-stamp"}`}>
              <Link2 size={16} /> {allChainOk ? "Verified on Monad" : "Chain check failed"}
            </div>
            <ul className="mt-3 space-y-3">
              {chain.map((c) => (
                <li key={c.minute} className="text-xs">
                  <div className="flex justify-between font-mono">
                    <span>minute {c.minute}</span>
                    <span className={c.rootMatches ? "text-match" : "text-stamp"}>{c.rootMatches ? "root matches" : "root differs"}</span>
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-muted">
                    <span>second {c.proofSecond} proof</span>
                    <span className={c.proofOk ? "text-match" : "text-stamp"}>{c.proofOk ? "valid onchain" : "invalid"}</span>
                  </div>
                  {c.stampedAt > 0 && (
                    <div className="mt-1 text-muted">stamped {new Date(c.stampedAt * 1000).toLocaleString()}</div>
                  )}
                </li>
              ))}
            </ul>
            {stream && txUrl(stream.openTx) && (
              <a
                href={txUrl(stream.openTx)!}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink"
              >
                stream record <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function Evidence({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card/70 p-4">
      <dt className="font-mono text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
      <dd className="text-xs text-muted">{sub}</dd>
    </div>
  );
}

export function SecondStrip({ seconds }: { seconds: Pick<SecondVerdict, "s" | "audio" | "picture" | "audioHits" | "pictureBits">[] }) {
  return (
    <div className="mt-8">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {[
          ["bg-match", "sound and picture"],
          ["bg-match/55", "sound only"],
          ["bg-warn/70", "picture only"],
          ["bg-stamp", "no match"],
        ].map(([cls, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${cls}`} /> {label}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {seconds.map((s, i) => {
          const both = s.audio && s.picture;
          const cls = both ? "bg-match" : s.audio ? "bg-match/55" : s.picture ? "bg-warn/70" : "bg-stamp";
          const jump = i > 0 && s.s !== seconds[i - 1].s + 1;
          return (
            <motion.div
              key={`${s.s}-${i}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 22 }}
              title={`second ${s.s}: sound ${s.audioHits} hits, picture ${s.pictureBits ?? "n/a"} bits apart`}
              className={`relative h-14 flex-1 origin-bottom rounded-md ${cls} ${jump ? "ml-3" : ""}`}
            >
              {jump && <span title="cut here" className="absolute -left-2.5 top-0 h-full w-1 rounded-full bg-warn" />}
            </motion.div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs text-muted tabular">
        <span>{timecode(seconds[0].s)}</span>
        <span>{timecode(seconds.at(-1)!.s + 1)}</span>
      </div>
    </div>
  );
}
