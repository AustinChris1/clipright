"use client";

import { buildMinute, checkClip, landmarks, landmarksForMinuteSlice, resample, SAMPLE_RATE, type CheckResult, type MinuteFile } from "@clipright/engine";
import { BadgeCheck, Download, Fuel, Loader2, Mic, Pointer, RotateCcw, Scissors, Square } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { openStream, stampMinute, verifyOnChain, type MinuteCheck } from "@/lib/client/api";
import { localKey } from "@/lib/client/passkey";
import { encodeWav } from "@/lib/client/wav";
import { txUrl } from "@/lib/config";

const LINE = "I would never take the money. The offer was real, and I turned it down.";
const MIN_SEC = 8;
const MAX_SEC = 30;
const BARS = 120;

type Phase =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "recorded" }
  | { kind: "stamping"; step: string }
  | { kind: "done"; honest: Outcome; edited: Outcome; tx: string | null }
  | { kind: "error"; message: string };

interface Outcome {
  result: CheckResult;
  chain: MinuteCheck[];
  url: string;
}

const btn = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition disabled:opacity-40";

export function TryIt() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [pcm, setPcm] = useState<{ data: Float32Array; rate: number } | null>(null);
  const [cutAt, setCutAt] = useState(0.4);
  const [cutLen, setCutLen] = useState(1);
  const rec = useRef<{ ctx: AudioContext; stream: MediaStream; chunks: Float32Array[]; timer: ReturnType<typeof setInterval> } | null>(null);

  useEffect(() => () => stopTracks(), []);

  function stopTracks() {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    r.ctx.close().catch(() => {});
    rec.current = null;
  }

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      const ctx = new AudioContext();
      await ctx.audioWorklet.addModule("/pcm-capture.js");
      const node = new AudioWorkletNode(ctx, "pcm-capture");
      const chunks: Float32Array[] = [];
      let total = 0;
      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        chunks.push(e.data);
        total += e.data.length;
        let peak = 0;
        for (let i = 0; i < e.data.length; i += 16) peak = Math.max(peak, Math.abs(e.data[i]));
        setLevel(peak);
      };
      const mute = ctx.createGain();
      mute.gain.value = 0;
      ctx.createMediaStreamSource(stream).connect(node).connect(mute).connect(ctx.destination);
      const timer = setInterval(() => {
        const sec = total / ctx.sampleRate;
        setElapsed(sec);
        if (sec >= MAX_SEC) finish();
      }, 100);
      rec.current = { ctx, stream, chunks, timer };
      setElapsed(0);
      setPhase({ kind: "recording" });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Microphone unavailable" });
    }
  };

  const finish = () => {
    const r = rec.current;
    if (!r) return;
    const rate = r.ctx.sampleRate;
    const total = r.chunks.reduce((n, c) => n + c.length, 0);
    const data = new Float32Array(total);
    let o = 0;
    for (const c of r.chunks) {
      data.set(c, o);
      o += c.length;
    }
    stopTracks();
    setPcm({ data, rate });
    setPhase({ kind: "recorded" });
  };

  const duration = pcm ? pcm.data.length / pcm.rate : 0;
  const bars = useMemo(() => {
    if (!pcm) return [];
    const per = Math.floor(pcm.data.length / BARS);
    return Array.from({ length: BARS }, (_, b) => {
      let peak = 0;
      for (let i = b * per; i < (b + 1) * per; i += 8) peak = Math.max(peak, Math.abs(pcm.data[i]));
      return peak;
    });
  }, [pcm]);
  const maxBar = Math.max(0.01, ...bars);

  const run = async () => {
    if (!pcm) return;
    try {
      const { data, rate } = pcm;
      const seconds = Math.floor(duration);
      const key = localKey();
      setPhase({ kind: "stamping", step: "Opening a stream on Monad" });
      const stream = await openStream(key, `Try it ${new Date().toLocaleTimeString()}`);
      setPhase({ kind: "stamping", step: "Fingerprinting and stamping your recording" });
      const pcm8k = resample(data, rate, SAMPLE_RATE);
      const file: MinuteFile = buildMinute(stream.streamId, 0, landmarksForMinuteSlice(pcm8k, 0), new Map(), seconds);
      const receipt = await stampMinute(key, file);

      setPhase({ kind: "stamping", step: "Making two clips and checking both" });
      const at = (sec: number) => Math.round(sec * rate);
      const honestPcm = data.slice(at(0.5), at(duration - 0.3));
      const cutStart = Math.max(1, Math.min(duration - cutLen - 1, cutAt * duration));
      const editedPcm = new Float32Array(data.length - at(cutLen));
      editedPcm.set(data.subarray(0, at(cutStart)), 0);
      editedPcm.set(data.subarray(at(cutStart + cutLen)), at(cutStart));

      const check = async (clipPcm: Float32Array): Promise<Outcome> => {
        const clip8k = resample(clipPcm, rate, SAMPLE_RATE);
        const result = checkClip({ duration: clip8k.length / SAMPLE_RATE, landmarks: landmarks(clip8k), frames: [] }, [{ streamId: stream.streamId, minutes: [file] }]);
        const matched = result.seconds.filter((s) => s.audio).map((s) => s.s);
        const chain = result.streamId ? await verifyOnChain(stream.streamId, [file], matched.length ? matched : [0]) : [];
        return { result, chain, url: URL.createObjectURL(encodeWav(clipPcm, rate)) };
      };
      setPhase({ kind: "done", honest: await check(honestPcm), edited: await check(editedPcm), tx: receipt.tx });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong" });
    }
  };

  const reset = () => {
    if (phase.kind === "done") [phase.honest.url, phase.edited.url].forEach(URL.revokeObjectURL);
    setPcm(null);
    setPhase({ kind: "idle" });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Say this, twice, slowly</p>
        <p className="mt-3 font-display text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">&ldquo;{LINE}&rdquo;</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {phase.kind === "recording" ? (
            <button onClick={finish} disabled={elapsed < MIN_SEC} className={`${btn} bg-stamp text-white`}>
              <Square size={14} /> {elapsed < MIN_SEC ? `Keep talking (${Math.ceil(MIN_SEC - elapsed)}s)` : "Stop"}
            </button>
          ) : (
            <button onClick={pcm ? reset : start} disabled={phase.kind === "stamping"} className={`${btn} ${pcm ? "border border-line" : "bg-ink text-paper"}`}>
              {pcm ? <RotateCcw size={16} /> : <Mic size={16} />} {pcm ? "Record again" : "Record"}
            </button>
          )}
          {phase.kind === "recording" && (
            <span className="inline-flex items-center gap-3 font-mono text-sm tabular">
              <span className="size-2 animate-pulse rounded-full bg-stamp" />
              {elapsed.toFixed(1)}s
              <span className="h-2 w-28 overflow-hidden rounded-full bg-line">
                <span className="block h-full bg-match transition-all" style={{ width: `${Math.min(100, level * 140)}%` }} />
              </span>
            </span>
          )}
        </div>
      </div>

      {pcm && phase.kind !== "done" && (
        <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">
          <p className="font-medium">Choose where to cut</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
            <Pointer size={14} /> Tap where &ldquo;never&rdquo; is
          </p>
          <button
            type="button"
            aria-label="Choose the cut point"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setCutAt(Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width)));
            }}
            className="relative mt-4 flex h-24 w-full items-center gap-[2px]"
          >
            {bars.map((b, i) => {
              const t = (i / BARS) * duration;
              const cut = t >= cutAt * duration && t < cutAt * duration + cutLen;
              return <span key={i} className={`flex-1 rounded-full ${cut ? "bg-warn" : "bg-ink/70"}`} style={{ height: `${Math.max(4, (b / maxBar) * 100)}%` }} />;
            })}
          </button>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Cut length</span>
            {[0.5, 1, 2].map((v) => (
              <button
                key={v}
                onClick={() => setCutLen(v)}
                className={`rounded-full border px-3 py-1 font-mono ${cutLen === v ? "border-ink bg-ink text-paper" : "border-line"}`}
              >
                {v}s
              </button>
            ))}
            <span className="ml-auto font-mono text-xs text-muted">
              cut at {(cutAt * duration).toFixed(1)}s of {duration.toFixed(1)}s
            </span>
          </div>
          <button onClick={run} disabled={phase.kind === "stamping"} className={`${btn} mt-6 w-full bg-ink text-paper sm:w-auto`}>
            {phase.kind === "stamping" ? <Loader2 size={16} className="animate-spin" /> : <Scissors size={16} />}
            {phase.kind === "stamping" ? phase.step : "Stamp it, cut it, check both"}
          </button>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
            <Fuel size={12} /> 2 testnet transactions, gas paid by Clipright
          </p>
        </div>
      )}

      {phase.kind === "error" && <p className="rounded-2xl bg-stamp/10 px-4 py-3 text-sm text-stamp">{phase.message}</p>}

      {phase.kind === "done" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ResultCard title="Your recording, trimmed" outcome={phase.honest} file="clipright-original.wav" />
            <ResultCard title="The edited copy" outcome={phase.edited} file="clipright-edited.wav" />
          </div>
          <p className="text-sm text-muted">
            Both were checked against the minute you just stamped
            {phase.tx && txUrl(phase.tx) ? (
              <>
                {" "}
                (
                <a href={txUrl(phase.tx)!} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-4">
                  stamp on Monad
                </a>
                )
              </>
            ) : null}
            . Download them and drop either into <a href="/check" className="underline decoration-line underline-offset-4">Check a clip</a> to see the same
            answer there.
          </p>
        </div>
      )}
    </div>
  );
}

function ResultCard({ title, outcome, file }: { title: string; outcome: Outcome; file: string }) {
  const { result, chain } = outcome;
  const edited = result.status === "match" && result.edits.length > 0;
  const verified = chain.length > 0 && chain.every((c) => c.rootMatches && c.proofOk);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border p-6 ${edited ? "border-warn/40 bg-warn/5" : result.status === "match" ? "border-match/40 bg-match/5" : "border-stamp/40 bg-stamp/5"}`}
    >
      <p className="text-sm text-muted">{title}</p>
      <p className={`mt-1 inline-flex items-center gap-2 font-display text-2xl font-semibold ${edited ? "text-warn" : result.status === "match" ? "text-match" : "text-stamp"}`}>
        {edited ? <Scissors size={20} /> : <BadgeCheck size={20} />}
        {edited ? "Edited" : result.status === "match" ? "Matches what you said" : "No match"}
      </p>
      {result.edits.map((e, i) => (
        <p key={i} className="mt-2 text-sm">
          {e.kind === "cut" ? `${e.seconds.toFixed(1)} s cut out at ${e.atClipSec}s into the clip.` : e.kind === "inserted" ? `${e.seconds}s at ${e.atClipSec}s are not from your recording.` : `Out of order at ${e.atClipSec}s.`}
        </p>
      ))}
      <div className="mt-4 flex gap-[3px]">
        {result.seconds.map((s, i) => (
          <span
            key={`${s.s}-${i}`}
            className={`h-8 flex-1 rounded ${s.audio ? "bg-match" : s.quiet ? "bg-line" : "bg-stamp"} ${i > 0 && s.s !== result.seconds[i - 1].s + 1 ? "ml-2 outline outline-2 outline-warn" : ""}`}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={verified ? "text-match" : "text-muted"}>{verified ? "Verified on Monad" : chain.length ? "Chain check failed" : ""}</span>
        <a href={outcome.url} download={file} className="inline-flex items-center gap-1 underline decoration-line underline-offset-4">
          <Download size={14} /> {file}
        </a>
      </div>
      <audio src={outcome.url} controls className="mt-3 w-full" />
    </motion.div>
  );
}
