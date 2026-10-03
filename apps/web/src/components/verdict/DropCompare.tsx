"use client";

import { audioIsMatch, landmarks, matchAudio, SAMPLE_RATE } from "@clipright/engine";
import { CircleCheck, CircleSlash, FileSearch, Loader2 } from "lucide-react";
import { useState } from "react";
import { decodePcm8k } from "@/lib/client/media";

type State = { kind: "idle" } | { kind: "working" } | { kind: "same" } | { kind: "other"; reason: string } | { kind: "error"; message: string };

// Is the clip you saw the one that was checked? Compared by sound in your browser.
export function DropCompare({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const run = async (file: File) => {
    setState({ kind: "working" });
    try {
      const [pcm, stored] = await Promise.all([decodePcm8k(file), fetch(`/api/verdicts/${id}`).then((r) => r.json())]);
      const index = new Map<number, number[]>();
      for (const [hash, frame] of stored.landmarks as [number, number][]) {
        const list = index.get(hash);
        if (list) list.push(frame);
        else index.set(hash, [frame]);
      }
      const m = matchAudio(landmarks(pcm), index, pcm.length / SAMPLE_RATE);
      if (audioIsMatch(m) && Math.abs(m!.offsetSec) < 1.5) setState({ kind: "same" });
      else setState({ kind: "other", reason: audioIsMatch(m) ? "It overlaps, but starts at a different moment." : "Its sound does not line up." });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Could not read that file" });
    }
  };

  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-line bg-card p-4 text-sm transition hover:border-ink/40">
      <input type="file" accept="video/*,audio/*" className="sr-only" onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
      {state.kind === "working" ? (
        <span className="inline-flex items-center gap-2 text-muted">
          <Loader2 size={15} className="animate-spin" /> Comparing
        </span>
      ) : state.kind === "same" ? (
        <span className="inline-flex items-center gap-2 font-medium text-match">
          <CircleCheck size={16} /> Same clip as the one checked
        </span>
      ) : state.kind === "other" ? (
        <span className="inline-flex items-start gap-2 text-stamp">
          <CircleSlash size={16} className="mt-0.5 shrink-0" /> Not the clip that was checked. {state.reason}
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-muted">
          <FileSearch size={16} /> {state.kind === "error" ? state.message : "Is yours the same clip? Drop it here"}
        </span>
      )}
    </label>
  );
}
