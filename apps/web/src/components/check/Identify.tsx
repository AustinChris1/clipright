"use client";

import type { Landmark } from "@clipright/engine";
import { BookOpenText, Clapperboard, ExternalLink, Loader2, Lock, MessageSquareQuote, Play, Search, Sparkles, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { identifyClip, lookupLead, type CatalogHit, type Identification } from "@/lib/client/identify";

type Ai = { kind: "idle" } | { kind: "working" } | { kind: "done"; id: Identification } | { kind: "error"; message: string };

// For clips nobody stamped: known leads appear on their own, the AI runs only when asked.
export function Identify({ file, landmarks, duration }: { file: File; landmarks: Landmark[]; duration: number }) {
  const [known, setKnown] = useState<CatalogHit[] | null>(null);
  const [ai, setAi] = useState<Ai>({ kind: "idle" });

  useEffect(() => {
    let live = true;
    lookupLead(landmarks, duration)
      .catch(() => [])
      .then((hits) => live && setKnown(hits));
    return () => {
      live = false;
    };
  }, [landmarks, duration]);

  const ask = async () => {
    setAi({ kind: "working" });
    try {
      setAi({ kind: "done", id: await identifyClip(file) });
    } catch (e) {
      setAi({ kind: "error", message: e instanceof Error ? e.message : "Lookup failed" });
    }
  };

  const id = ai.kind === "done" ? ai.id : null;
  const hits = dedupe([...(known ?? []), ...(id?.catalog ?? [])]);
  const query = encodeURIComponent(id?.lines[0] ? `"${id.lines[0]}"` : hits[0]?.title ?? id?.ai?.description ?? "");

  return (
    <div className="rounded-3xl border border-line bg-card p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          <Search size={18} /> Leads
        </p>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">not proof</span>
      </div>

      {known === null ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Checking known clips
        </p>
      ) : (
        hits.length > 0 && (
          <ul className="mt-4 space-y-2">
            {hits.map((c) => (
              <Hit key={c.source + c.title} hit={c} cached={!!known.find((k) => k.title === c.title)} />
            ))}
          </ul>
        )
      )}

      <AnimatePresence mode="wait">
        {ai.kind === "done" && id ? (
          <motion.div key="ai" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
            {!id.catalog.length && !known?.length && (
              <p className="text-sm text-muted">{id.lines.length ? "No catalog has these lines." : "No speech to look up."}</p>
            )}
            {id.lines.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {id.lines.map((l) => (
                  <span key={l} className="inline-flex items-start gap-1.5 rounded-2xl bg-paper px-3 py-1.5 text-sm">
                    <MessageSquareQuote size={14} className="mt-0.5 shrink-0 text-muted" /> {l}
                  </span>
                ))}
              </div>
            )}
            {id.ai && (
              <div className="rounded-2xl border border-warn/40 bg-warn/5 p-4 text-sm">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-warn">
                  <TriangleAlert size={13} /> AI guess, unverified
                </p>
                {id.ai.title && <p className="mt-1.5 font-display text-xl font-semibold">{id.ai.title}?</p>}
                <p className="mt-1 text-muted">{id.ai.description}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <a href={`https://www.google.com/search?q=${query}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 hover:border-ink">
                <Search size={14} /> Google
              </a>
              <a href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 hover:border-ink">
                <Play size={14} /> YouTube
              </a>
              <span className="ml-auto font-mono text-xs text-muted">{id.model}</span>
            </div>
          </motion.div>
        ) : known !== null ? (
          <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={ask}
              disabled={ai.kind === "working"}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-60"
            >
              {ai.kind === "working" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {ai.kind === "working" ? "Listening" : hits.length ? "Ask AI for more" : "Find a lead"}
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Lock size={12} /> 8 frames and the sound go to Google, not the file
            </span>
            {ai.kind === "error" && <p className="w-full rounded-full bg-stamp/10 px-4 py-1.5 text-sm text-stamp">{ai.message}</p>}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Hit({ hit, cached }: { hit: CatalogHit; cached: boolean }) {
  const Icon = hit.source === "Wikiquote" ? BookOpenText : Clapperboard;
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-match/40 bg-match/5 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-match text-white">
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <a href={hit.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline decoration-line underline-offset-4">
          {hit.title} <ExternalLink size={12} />
        </a>
        <p className="truncate text-xs text-muted">
          {hit.source === "Wikiquote" ? <>&ldquo;{hit.matched}&rdquo;</> : `${hit.detail ?? ""} · ${hit.matched}`}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[11px] text-muted">{cached ? "seen before" : hit.source}</span>
    </li>
  );
}

function dedupe(hits: CatalogHit[]) {
  const seen = new Set<string>();
  return hits.filter((h) => !seen.has(h.title) && seen.add(h.title));
}
