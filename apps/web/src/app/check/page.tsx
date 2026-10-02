import type { Metadata } from "next";
import { Checker } from "@/components/check/Checker";

export const metadata: Metadata = { title: "Check a clip | Clipright" };

export default function CheckPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-stamp">Check</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Where did this clip come from?</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Drop a clip from a stream that was stamped on Clipright. It finds the stream, the second, and anything cut out or added, then asks Monad whether
        those minutes are on record. Footage nobody stamped, like a TV show, will not match.
      </p>
      <div className="mt-10">
        <Checker />
      </div>
    </section>
  );
}
