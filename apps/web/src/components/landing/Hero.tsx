"use client";

import { ArrowRight, BadgeCheck } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const BARS = 120;
const TARGET = 0.62;

function bars(seed: number) {
  let x = seed;
  return Array.from({ length: BARS }, (_, i) => {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280;
    return 0.25 + 0.75 * Math.abs(Math.sin(i * 0.37) * 0.6 + r * 0.5);
  });
}

export function Hero() {
  const heights = useMemo(() => bars(7), []);
  const pos = useMotionValue(0.08);
  const left = useTransform(pos, (p) => `${p * 100}%`);
  const seconds = useTransform(pos, (p) => p * 180 + 1182);
  const [time, setTime] = useState("19:42.0");
  const [locked, setLocked] = useState(false);

  useEffect(() => seconds.on("change", (v) => setTime(`${Math.floor(v / 60)}:${(v % 60).toFixed(1).padStart(4, "0")}`)), [seconds]);

  useEffect(() => {
    let cancelled = false;
    const loop = async () => {
      while (!cancelled) {
        setLocked(false);
        pos.set(0.08);
        await animate(pos, [0.08, 0.81, 0.34, TARGET], { duration: 3.2, ease: [0.65, 0, 0.35, 1], times: [0, 0.45, 0.75, 1] });
        if (cancelled) return;
        setLocked(true);
        await new Promise((r) => setTimeout(r, 2600));
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [pos]);

  return (
    <section className="relative overflow-hidden">
      <div className="grain pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">
            Clip provenance on Monad
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-7xl"
          >
            Proof a clip came from the stream.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-6 max-w-md text-lg text-muted">
            Drop any clip. Get the stream it came from, to the second, or a plain no.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 flex flex-wrap gap-3">
            <Link href="/check" className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-paper">
              Check a clip <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>
            <Link href="/live" className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 hover:border-ink">
              Stamp your stream
            </Link>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="rounded-[2rem] border border-line bg-card p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] sm:p-7">
          <div className="flex items-center justify-between font-mono text-xs text-muted">
            <span>stream / late night run</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-stamp" /> stamped each minute
            </span>
          </div>

          <div className="relative mt-6 h-40">
            <div className="absolute inset-x-0 bottom-8 top-6 flex items-center gap-[2px]">
              {heights.map((h, i) => (
                <div key={i} className="flex-1 rounded-full bg-ink/80" style={{ height: `${h * 100}%`, opacity: 0.25 + h * 0.55 }} />
              ))}
            </div>
            {[0, 1, 2, 3].map((m) => (
              <div key={m} className="absolute bottom-0 top-0 flex flex-col items-center" style={{ left: `${(m / 3) * 100}%`, transform: `translateX(${m === 0 ? "0" : m === 3 ? "-100%" : "-50%"})` }}>
                <div className="w-px flex-1 bg-line" />
                <span className="mt-1 whitespace-nowrap rounded bg-stamp px-1.5 py-0.5 font-mono text-[10px] text-white">min {m}</span>
              </div>
            ))}
            <motion.div style={{ left }} className="absolute bottom-6 top-3 w-[16%] -translate-x-1/2">
              <div className={`h-full rounded-lg border-[3px] transition-colors ${locked ? "border-match bg-match/10" : "border-ink bg-ink/5"}`} />
              <div className={`absolute -top-7 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 font-mono text-[11px] tabular ${locked ? "bg-match text-white" : "bg-ink text-paper"}`}>
                {time}
              </div>
            </motion.div>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3">
            <span className="font-mono text-xs text-muted">clip_0427.mp4 · 9:16 · captions</span>
            <motion.span
              animate={{ opacity: locked ? 1 : 0.25, scale: locked ? 1 : 0.95 }}
              className={`inline-flex items-center gap-1.5 text-sm font-medium ${locked ? "text-match" : "text-muted"}`}
            >
              <BadgeCheck size={16} /> {locked ? "Match, verified onchain" : "Matching"}
            </motion.span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
