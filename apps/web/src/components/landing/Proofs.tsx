"use client";

import { motion } from "motion/react";

// Results from packages/engine/scripts/gate.ts on its synthetic two-minute stream.
const cases = [
  { name: "Vertical crop, captions, re-encoded", verdict: "Matched at 47.297s", truth: "true start 47.3s", cells: "gggggggggggggg", tone: "text-match" },
  { name: "Same pictures, sound replaced", verdict: "Pictures match, sound flagged", truth: "located at 47.25s", cells: "aaaaaaaaaaaaaa", tone: "text-warn" },
  { name: "Unrelated video", verdict: "No match", truth: "nothing to find", cells: "rrrrrrrrrrrrrr", tone: "text-stamp" },
  { name: "Landscape, 480p, low bitrate", verdict: "Matched at 88.602s", truth: "true start 88.6s", cells: "ggggggggggg", tone: "text-match" },
];

const cellColor: Record<string, string> = { g: "bg-match", a: "bg-warn/70", r: "bg-stamp/80" };

export function Proofs() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Try to fool it</p>
      <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight">Four clips from our test suite, and what Clipright said.</h2>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {cases.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ y: -4 }}
            className="rounded-3xl border border-line bg-card p-6"
          >
            <p className="text-sm text-muted">{c.name}</p>
            <p className={`mt-2 font-display text-2xl font-semibold ${c.tone}`}>{c.verdict}</p>
            <p className="font-mono text-xs text-muted">{c.truth}</p>
            <div className="mt-5 flex gap-1">
              {c.cells.split("").map((k, j) => (
                <motion.div
                  key={j}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + j * 0.03 }}
                  className={`h-8 flex-1 origin-bottom rounded ${cellColor[k]}`}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">One cell per second of the clip. Run it yourself with pnpm gate.</p>
    </section>
  );
}
