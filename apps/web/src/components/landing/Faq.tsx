"use client";

import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

const faqs = [
  {
    q: "What does Clipright prove?",
    a: "That a clip came from a stream stamped while it happened: which stream, which second, and whether anything was cut out or added. It is not a deepfake detector for footage nobody stamped.",
  },
  {
    q: "Do I need a wallet or crypto?",
    a: "No. A passkey (Face ID, a fingerprint or your device PIN) creates the key that signs stamps, and Clipright pays the gas. Linking a wallet is optional.",
  },
  {
    q: "Is my video uploaded?",
    a: "No. Sound and picture fingerprints are made in your browser and only those are stored. Find a lead is the one exception, and only when you press it.",
  },
  {
    q: "Why Monad? Could it run on another chain?",
    a: "The contract is plain Solidity, so it could run on any EVM chain. Monad is the one that fits: a stamp every minute needs low fees (about $0.10 for a six-hour stream), finality the protocol guarantees in 0.6 s rather than a rollup sequencer's promise, and room for thousands of streams stamping at once.",
  },
  {
    q: "What if a clip is not on record?",
    a: "You get an honest No match. Then Clipright can look the spoken lines up on Wikiquote for a lead you can check. AI guesses stay labelled unverified.",
  },
  {
    q: "Can a shared link be faked?",
    a: "The server matches the clip again before it makes a link, and the page asks Monad again for every visitor. Anyone can drop their copy on the page to confirm it is the same clip.",
  },
  {
    q: "Does it work on TikTok and Reels clips?",
    a: "Yes, if they were cut from a stamped stream. Vertical crops, captions and re-encoding still match; the sound carries most of the proof.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">FAQ</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">Questions, answered short.</h2>
          <Link href="/docs/faq" className="mt-4 inline-block text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            More in the docs
          </Link>
        </div>
        <ul className="divide-y divide-line rounded-3xl border border-line bg-card">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium sm:px-6"
                >
                  {f.q}
                  <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }} className="shrink-0 text-stamp">
                    <Plus size={18} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-muted sm:px-6">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
