"use client";

import type { ClipPrint } from "@clipright/engine";
import { Check, Copy, ExternalLink, Link2, Loader2, Share2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { Hex } from "viem";
import { createShareLink } from "@/lib/client/share";

type State = { kind: "idle" } | { kind: "working" } | { kind: "done"; url: string; copied: boolean } | { kind: "error"; message: string };

// A link a clipper can post next to their clip; the page re-checks Monad for every viewer.
export function ShareLink({ file, print, streamId, title, edited }: { file: File; print: ClipPrint; streamId: Hex; title: string; edited: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const make = async () => {
    setState({ kind: "working" });
    try {
      setState({ kind: "done", url: await createShareLink(file, print, streamId), copied: false });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Could not create the link" });
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url).catch(() => {});
    setState({ kind: "done", url, copied: true });
  };

  if (state.kind === "done") {
    const text = edited ? `This clip was edited from "${title}". Checked against the stamped stream on Monad:` : `A faithful cut of "${title}", checked against the stamped stream on Monad:`;
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-line bg-card p-5 sm:p-6">
        <p className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          <Link2 size={18} /> Your link
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={state.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate rounded-full border border-line bg-paper px-4 py-2.5 font-mono text-sm">
            {state.url.replace(/^https?:\/\//, "")}
          </a>
          <button onClick={() => copy(state.url)} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper">
            {state.copied ? <Check size={15} /> : <Copy size={15} />} {state.copied ? "Copied" : "Copy"}
          </button>
          <a
            href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(state.url)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm hover:border-ink"
          >
            Post on X <ExternalLink size={13} />
          </a>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-card p-5 sm:p-6">
      <button
        onClick={make}
        disabled={state.kind === "working"}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-60"
      >
        {state.kind === "working" ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
        {state.kind === "working" ? "Making your link" : "Get a shareable link"}
      </button>
      <span className="text-sm text-muted">Post it next to the clip. Anyone who opens it sees this result, re-checked on Monad.</span>
      {state.kind === "error" && <p className="w-full rounded-full bg-stamp/10 px-4 py-1.5 text-sm text-stamp">{state.message}</p>}
    </div>
  );
}
