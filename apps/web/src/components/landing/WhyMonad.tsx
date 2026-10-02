"use client";

import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

function Count({ to, decimals = 0, prefix = "", suffix = "" }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
  }, [seen, to]);
  return (
    <span ref={ref} className="tabular">
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

const stats = [
  { value: <Count to={0.3} decimals={1} suffix="s" />, label: "block time", note: "a stamp lands long before anyone can cut and post a clip" },
  { value: <Count to={0.6} decimals={1} suffix="s" />, label: "to finality", note: "the record is settled, not pending" },
  { value: <Count to={0.1} decimals={2} prefix="$" />, label: "per six-hour stream", note: "360 stamps at the minimum fee, MON at $0.027 to $0.029" },
];

const limits = [
  "It is not a deepfake detector. It proves footage lines up with what was stamped.",
  "If a clip swaps the sound for a song, only the picture check is left.",
  "It does not count views or catch bot views.",
  "It only covers streams that were stamped.",
];

export function WhyMonad() {
  return (
    <section className="mx-auto grid max-w-6xl gap-16 px-4 pb-24 sm:px-6 lg:grid-cols-2">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Why Monad</p>
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">Cheap and fast enough to stamp every minute.</h2>
        <div className="mt-10 space-y-8">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-5xl font-semibold tracking-tight">{s.value}</span>
                <span className="text-muted">{s.label}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{s.note}</p>
            </motion.div>
          ))}
        </div>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">What it does not do</p>
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">The limits, up front.</h2>
        <ul className="mt-10 space-y-3">
          {limits.map((l, i) => (
            <motion.li
              key={l}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-3 rounded-2xl border border-line bg-card p-4"
            >
              <span className="font-mono text-xs text-stamp">0{i + 1}</span>
              <span>{l}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
