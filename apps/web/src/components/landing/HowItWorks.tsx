"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Mic, ScanSearch, Stamp } from "lucide-react";
import { useEffect, useRef } from "react";

const steps = [
  { icon: Mic, title: "Record", line: "Your browser fingerprints the sound and picture of every second.", detail: "the video never leaves your device" },
  { icon: Stamp, title: "Stamp", line: "Each minute becomes one code, signed by your passkey, written to Monad.", detail: "one transaction a minute" },
  { icon: ScanSearch, title: "Check", line: "Anyone drops a clip and gets the stream and the second, or a miss.", detail: "checked against the chain, not us" },
];

export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(".how-line", { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top 70%", end: "bottom 60%", scrub: true } });
      gsap.utils.toArray<HTMLElement>(".how-step").forEach((el, i) => {
        gsap.fromTo(el, { opacity: 0.25, y: 24 }, { opacity: 1, y: 0, scrollTrigger: { trigger: root.current, start: `top ${70 - i * 12}%`, end: `top ${45 - i * 12}%`, scrub: true } });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section className="border-y border-line bg-card">
      <div ref={root} className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">How it works</p>
        <h2 className="mt-3 max-w-xl font-display text-4xl font-semibold tracking-tight">A notary that stamps every minute.</h2>
        <div className="relative mt-14">
          <div className="how-line absolute left-0 right-0 top-6 hidden h-[3px] origin-left bg-stamp md:block" />
          <ol className="grid gap-10 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="how-step relative">
                <div className="relative z-10 grid size-12 place-items-center rounded-2xl bg-ink text-paper">
                  <s.icon size={22} />
                </div>
                <p className="mt-5 font-mono text-xs text-muted">0{i + 1}</p>
                <h3 className="font-display text-2xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.line}</p>
                <p className="mt-3 inline-block rounded-full border border-line px-3 py-1 font-mono text-xs">{s.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
