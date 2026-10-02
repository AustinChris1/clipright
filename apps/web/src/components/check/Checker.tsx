"use client";

import { checkClip, type CheckResult, type MinuteFile } from "@clipright/engine";
import { FileVideo, Loader2, RotateCcw, Upload } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import type { Hex } from "viem";
import { getStream, listStreams, stampTimes, verifyOnChain, type MinuteCheck, type OnRecord } from "@/lib/client/api";
import { openClip } from "@/lib/client/media";
import type { StreamMeta } from "@/lib/types";
import { Verdict } from "./Verdict";

type Phase =
  | { kind: "idle" }
  | { kind: "working"; stage: string; progress: number }
  | { kind: "done"; result: CheckResult; stream: StreamMeta | null; chain: MinuteCheck[]; clipUrl: string; fileName: string; ms: number; duration: number; onRecord: OnRecord[]; hasVideo: boolean; streamsChecked: number; minutesChecked: number }
  | { kind: "error"; message: string };

export function Checker() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = useCallback(async (file: File) => {
    const started = performance.now();
    try {
      setPhase({ kind: "working", stage: "Listening", progress: 0 });
      const opened = await openClip(file, (stage, progress) => setPhase({ kind: "working", stage, progress }));
      const clip = opened.print;
      let result: CheckResult;
      let details: Awaited<ReturnType<typeof getStream>>[] = [];
      try {
        setPhase({ kind: "working", stage: "Comparing with stamped streams", progress: 1 });
        const streams = await listStreams();
        details = await Promise.all(streams.filter((s) => s.fingerprints).map((s) => getStream(s.streamId)));
        const candidates = details.map((d) => ({ streamId: d.meta.streamId, minutes: d.minutes as MinuteFile[] }));
        result = checkClip(clip, candidates);
        // Once the offset is known, grab exact frames for the matched seconds and score again.
        if (result.offsetSec !== null && clip.frames.length) {
          setPhase({ kind: "working", stage: "Confirming pictures", progress: 1 });
          await opened.fill(result.seconds.map((s) => s.s + 0.5 - result.offsetSec!));
          result = checkClip(clip, candidates);
        }
      } finally {
        opened.close();
      }
      let chain: MinuteCheck[] = [];
      let stream: StreamMeta | null = null;
      let onRecord: OnRecord[] = [];
      if (result.streamId) {
        setPhase({ kind: "working", stage: "Asking Monad", progress: 1 });
        const detail = details.find((d) => d.meta.streamId === result.streamId)!;
        stream = detail.meta;
        const matched = result.seconds.filter((s) => s.audio || s.picture).map((s) => s.s);
        chain = await verifyOnChain(result.streamId as Hex, detail.minutes, matched.length ? matched : result.seconds.map((s) => s.s));
        if (result.alsoFound.length) {
          const title = (id: Hex) => details.find((d) => d.meta.streamId === id)?.meta.title ?? id;
          onRecord = await stampTimes([
            { streamId: result.streamId as Hex, title: stream.title, offsetSec: result.offsetSec!, best: true },
            ...result.alsoFound.map((a) => ({ streamId: a.streamId as Hex, title: title(a.streamId as Hex), offsetSec: a.offsetSec, best: false })),
          ]);
        }
      }
      setPhase({
        kind: "done",
        result,
        stream,
        chain,
        clipUrl: URL.createObjectURL(file),
        fileName: file.name,
        ms: performance.now() - started,
        duration: clip.duration,
        onRecord,
        hasVideo: clip.frames.length > 0,
        streamsChecked: details.length,
        minutesChecked: details.reduce((n, d) => n + d.minutes.length, 0),
      });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong" });
    }
  }, []);

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) run(f);
  };

  const reset = () => {
    if (phase.kind === "done") URL.revokeObjectURL(phase.clipUrl);
    setPhase({ kind: "idle" });
    if (input.current) input.current.value = "";
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {phase.kind === "idle" || phase.kind === "error" ? (
          <motion.label
            key="drop"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              onFiles(e.dataTransfer.files);
            }}
            className={`group relative flex min-h-72 cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition ${
              over ? "border-stamp bg-stamp/5" : "border-line bg-card hover:border-ink/40"
            }`}
          >
            <input ref={input} type="file" accept="video/*,audio/*" className="sr-only" onChange={(e) => onFiles(e.target.files)} />
            <motion.div animate={{ y: over ? -6 : 0 }} className="grid size-16 place-items-center rounded-2xl bg-ink text-paper">
              <Upload size={26} />
            </motion.div>
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight">Drop a clip here</p>
              <p className="mt-1 text-sm text-muted">MP4, MOV or WebM. It is fingerprinted in your browser and never uploaded.</p>
            </div>
            {phase.kind === "error" && <p className="rounded-full bg-stamp/10 px-4 py-1.5 text-sm text-stamp">{phase.message}</p>}
            <a
              href="/docs/test-it#clips"
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink"
            >
              No clip handy? Download a test clip
            </a>
          </motion.label>
        ) : phase.kind === "working" ? (
          <motion.div
            key="working"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-72 flex-col items-center justify-center gap-5 rounded-3xl border border-line bg-card p-10"
          >
            <Loader2 className="animate-spin text-stamp" size={28} />
            <p className="font-display text-xl font-semibold">{phase.stage}</p>
            <div className="h-1.5 w-64 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full bg-ink" animate={{ width: `${Math.round(phase.progress * 100)}%` }} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm text-muted">
                <FileVideo size={16} className="shrink-0" />
                <span className="truncate">{phase.fileName}</span>
                <span className="shrink-0 font-mono text-xs">checked in {(phase.ms / 1000).toFixed(1)}s</span>
              </span>
              <button onClick={reset} className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
                <RotateCcw size={14} /> Check another
              </button>
            </div>
            <Verdict result={phase.result} stream={phase.stream} chain={phase.chain} clipUrl={phase.clipUrl} duration={phase.duration} onRecord={phase.onRecord} hasVideo={phase.hasVideo} streamsChecked={phase.streamsChecked} minutesChecked={phase.minutesChecked} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
