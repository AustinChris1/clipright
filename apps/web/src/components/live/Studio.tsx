"use client";

import type { MinuteFile } from "@clipright/engine";
import { Camera, Download, ExternalLink, Fingerprint, KeyRound, Loader2, MonitorUp, Radio, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { openStream, stampMinute } from "@/lib/client/api";
import { LiveRecorder } from "@/lib/client/live";
import { createPasskeyKey, localKey, passkeyError, unlockPasskeyKey, type StampingKey } from "@/lib/client/passkey";
import { txUrl } from "@/lib/config";
import type { StreamMeta } from "@/lib/types";

interface StampRow {
  minute: number;
  seconds: number;
  root: string;
  status: "signing" | "stamped" | "failed";
  tx?: string;
  error?: string;
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-6">
      <div className="flex items-center gap-3">
        <span className={`grid size-7 place-items-center rounded-full font-mono text-xs ${done ? "bg-match text-paper" : "bg-ink text-paper"}`}>{n}</span>
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

const btn = "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition disabled:opacity-40";

export function Studio() {
  const [key, setKey] = useState<StampingKey | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [stream, setStream] = useState<StreamMeta | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rows, setRows] = useState<StampRow[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const recorder = useRef<LiveRecorder | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (video.current && media) video.current.srcObject = media;
  }, [media]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setElapsed(recorder.current?.elapsed ?? 0), 200);
    return () => clearInterval(t);
  }, [live]);

  const withKey = async (fn: () => Promise<StampingKey> | StampingKey) => {
    setKeyBusy(true);
    setKeyError(null);
    try {
      setKey(await fn());
    } catch (e) {
      setKeyError(passkeyError(e));
    } finally {
      setKeyBusy(false);
    }
  };

  const open = async () => {
    if (!key) return;
    setOpening(true);
    setOpenError(null);
    try {
      setStream(await openStream(key, title.trim()));
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : "Could not open the stream");
    } finally {
      setOpening(false);
    }
  };

  const pick = async (kind: "camera" | "screen") => {
    try {
      const m =
        kind === "camera"
          ? await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
          : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (!m.getAudioTracks().length) throw new Error("No audio was shared. For a tab, tick 'Share tab audio'.");
      setMedia(m);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : "Could not access the camera or screen");
    }
  };

  const onMinute = (file: MinuteFile) => {
    const row: StampRow = { minute: file.minute, seconds: file.seconds.length, root: file.root, status: "signing" };
    setRows((r) => [...r, row]);
    queue.current = queue.current.then(async () => {
      try {
        const receipt = await stampMinute(key!, file);
        setRows((r) => r.map((x) => (x.minute === file.minute ? { ...x, status: "stamped", tx: receipt.tx } : x)));
      } catch (e) {
        setRows((r) => r.map((x) => (x.minute === file.minute ? { ...x, status: "failed", error: e instanceof Error ? e.message : "failed" } : x)));
      }
    });
  };

  const start = async () => {
    if (!media || !stream || !video.current) return;
    const rec = new LiveRecorder(media, video.current, stream.streamId, { onMinute });
    await rec.start();
    recorder.current = rec;
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(media);
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => setRecording(URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || "video/webm" })));
    mr.start(1000);
    mediaRecorder.current = mr;
    setLive(true);
  };

  const stop = async () => {
    await recorder.current?.stop();
    mediaRecorder.current?.stop();
    media?.getTracks().forEach((t) => t.stop());
    setLive(false);
  };

  const secondInMinute = Math.floor(elapsed % 60);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Step n={1} title="Your stamping key" done={!!key}>
          {key ? (
            <div className="space-y-2 text-sm">
              <p className="font-mono text-xs break-all">{key.account.address}</p>
              <p className="text-muted">
                {key.kind === "passkey"
                  ? "Derived from your passkey with Clipright's own salt. It signs stamps and holds no funds."
                  : "A tab-only key for devices without passkey key derivation. It disappears when you close the tab."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <button disabled={keyBusy} onClick={() => withKey(() => createPasskeyKey(`Clipright ${new Date().toLocaleDateString()}`))} className={`${btn} w-full justify-center bg-ink text-paper`}>
                {keyBusy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />} Create a passkey
              </button>
              <button disabled={keyBusy} onClick={() => withKey(unlockPasskeyKey)} className={`${btn} w-full justify-center border border-line`}>
                <KeyRound size={16} /> Use my existing passkey
              </button>
              <button disabled={keyBusy} onClick={() => withKey(localKey)} className="w-full pt-1 text-center text-xs text-muted underline decoration-line underline-offset-4">
                No passkey support? Use a tab-only key
              </button>
              {keyError && <p className="text-xs text-stamp">{keyError}</p>}
            </div>
          )}
        </Step>

        <Step n={2} title="Open a stream" done={!!stream}>
          {stream ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{stream.title}</p>
              <p className="font-mono text-xs text-muted break-all">{stream.streamId}</p>
              {txUrl(stream.openTx) && (
                <a href={txUrl(stream.openTx)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline decoration-line underline-offset-4">
                  opened on Monad <ExternalLink size={11} />
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Stream title"
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink"
              />
              <button disabled={!key || !title.trim() || opening} onClick={open} className={`${btn} w-full justify-center bg-ink text-paper`}>
                {opening ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />} Open stream
              </button>
              {openError && <p className="text-xs text-stamp">{openError}</p>}
            </div>
          )}
        </Step>

        <Step n={3} title="Pick a source" done={!!media}>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={!stream || live} onClick={() => pick("camera")} className={`${btn} justify-center border border-line`}>
              <Camera size={16} /> Camera
            </button>
            <button disabled={!stream || live} onClick={() => pick("screen")} className={`${btn} justify-center border border-line`}>
              <MonitorUp size={16} /> Tab or screen
            </button>
          </div>
        </Step>
      </div>

      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-ink">
          <video ref={video} autoPlay muted playsInline className="aspect-video w-full object-contain" />
          {!media && <div className="absolute inset-0 grid place-items-center text-sm text-paper/60">Preview appears here</div>}
          {live && (
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-stamp px-3 py-1 font-mono text-xs text-white">
              <span className="size-2 animate-pulse rounded-full bg-white" /> STAMPING {Math.floor(elapsed / 60)}:{String(secondInMinute).padStart(2, "0")}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!live ? (
            <button disabled={!media || !stream} onClick={start} className={`${btn} bg-stamp text-white`}>
              <Radio size={16} /> Start stamping
            </button>
          ) : (
            <button onClick={stop} className={`${btn} bg-ink text-paper`}>
              <Square size={14} /> Stop and stamp the last minute
            </button>
          )}
          {recording && (
            <a href={recording} download="clipright-recording.webm" className={`${btn} border border-line`}>
              <Download size={16} /> Download recording
            </a>
          )}
          {recording && stream && (
            <Link href="/check" className="text-sm underline decoration-line underline-offset-4">
              Cut a clip from it and check it
            </Link>
          )}
        </div>

        {live && (
          <div>
            <p className="mb-2 text-xs text-muted">This minute, second by second. A stamp lands on Monad when it fills.</p>
            <div className="flex gap-[3px]">
              {Array.from({ length: 60 }, (_, i) => (
                <div key={i} className={`h-6 flex-1 rounded-sm transition-colors ${i < secondInMinute ? "bg-ink" : "bg-line"}`} />
              ))}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-line bg-card p-5">
          <h3 className="font-display text-lg font-semibold">Stamps</h3>
          {rows.length === 0 && <p className="mt-2 text-sm text-muted">Each finished minute appears here with its Monad transaction.</p>}
          <ul className="mt-3 divide-y divide-line">
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <motion.li key={r.minute} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-mono">
                    minute {r.minute} <span className="text-muted">({r.seconds}s)</span>
                  </span>
                  <span className="hidden font-mono text-xs text-muted sm:inline">{r.root.slice(0, 14)}...</span>
                  {r.status === "signing" && <Loader2 size={16} className="animate-spin text-muted" />}
                  {r.status === "stamped" &&
                    (r.tx && txUrl(r.tx) ? (
                      <a href={txUrl(r.tx)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-match">
                        stamped <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-match">stamped</span>
                    ))}
                  {r.status === "failed" && <span className="max-w-48 truncate text-stamp" title={r.error}>failed: {r.error}</span>}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}
