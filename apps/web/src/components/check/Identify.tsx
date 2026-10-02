"use client";

import { BookOpenText, ExternalLink, Loader2, Search, Sparkles, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { identifyClip, type Identification } from "@/lib/client/identify";

type State = { kind: "idle" } | { kind: "working" } | { kind: "done"; id: Identification } | { kind: "error"; message: string };

const kindLabel: Record<string, string> = {
  tv_episode: "TV episode",
  film: "Film",
  livestream: "Livestream",
  game: "Game",
  music_video: "Music video",
  sports: "Sports",
  news: "News",
  ad: "Ad",
  viral_video: "Viral video",
};

// For clips nobody stamped: look the lines up in open catalogs, then show an AI guess, clearly labelled.
export function Identify({ file }: { file: File }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const run = async () => {
    setState({ kind: "working" });
    try {
      setState({ kind: "done", id: await identifyClip(file) });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Lookup failed" });
    }
  };

  if (state.kind === "idle" || state.kind === "error")
    return (
      <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <Search size={16} /> Not on record. Want a lead on where it is from?
        </p>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Clipright can send 8 small frames and the sound to Google&apos;s Gemini to write down what is said, then search Wikiquote for those exact
          lines, and trace.moe if it looks like anime. The clip itself stays on your device. A lead is not proof.
        </p>
        {state.kind === "error" && <p className="mt-3 rounded-full bg-stamp/10 px-4 py-1.5 text-sm text-stamp">{state.message}</p>}
        <button onClick={run} className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:opacity-90">
          <Sparkles size={15} /> Find a lead
        </button>
      </div>
    );

  if (state.kind === "working")
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-line bg-card p-6 sm:p-8">
        <Loader2 className="animate-spin text-stamp" size={20} />
        <p className="text-sm">Listening for lines and searching open catalogs. This takes 10 to 30 seconds.</p>
      </div>
    );

  const { ai, catalog } = state.id;
  const quote = ai.lines[0];
  const q = encodeURIComponent(quote ? `"${quote}"` : ai.description);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 rounded-3xl border border-line bg-card p-6 sm:p-8">
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <Search size={16} /> Leads for this clip
      </p>

      {catalog.length > 0 ? (
        <ul className="space-y-2">
          {catalog.map((c) => (
            <li key={c.source + c.title} className="rounded-2xl border border-match/40 bg-match/5 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline decoration-line underline-offset-4">
                  {c.title} <ExternalLink size={12} />
                </a>
                <span className="rounded-full bg-match px-2 py-0.5 text-xs text-white">{c.source === "Wikiquote" ? "line found on Wikiquote" : "frame found on trace.moe"}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{c.source === "Wikiquote" ? <>Matched &ldquo;{c.matched}&rdquo;</> : c.matched}</p>
              {c.detail && <p className="mt-1 text-xs text-muted">{c.detail}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {ai.lines.length ? "None of the lines are on Wikiquote, so there is no catalog match." : "No speech was heard, so there were no lines to look up."}
        </p>
      )}

      {ai.lines.length > 0 && (
        <div>
          <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted">
            <BookOpenText size={12} /> What is said
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {ai.lines.map((l) => (
              <li key={l}>&ldquo;{l}&rdquo;</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-warn/40 bg-warn/5 p-4 text-sm">
        <p className="inline-flex items-center gap-1.5 font-medium text-warn">
          <TriangleAlert size={14} /> AI guess, unverified
        </p>
        <p className="mt-1">{ai.description}</p>
        {ai.title && (
          <p className="mt-2">
            Might be <strong>{ai.title}</strong>
            {ai.kind && kindLabel[ai.kind] ? <span className="text-muted"> ({kindLabel[ai.kind]})</span> : null}. Check it before you repeat it.
          </p>
        )}
        {ai.evidence.length > 0 && <p className="mt-1 text-xs text-muted">Noticed: {ai.evidence.join("; ")}</p>}
        <p className="mt-2 text-xs text-muted">Model {state.id.model}. AI models name the wrong film with high confidence, so no score is shown.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <a href={`https://www.google.com/search?q=${q}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 hover:border-ink">
          Search Google <ExternalLink size={12} />
        </a>
        <a href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-4 py-2 hover:border-ink">
          Search YouTube <ExternalLink size={12} />
        </a>
      </div>
    </motion.div>
  );
}
