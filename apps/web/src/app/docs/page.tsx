import { ArrowRight, Mic, ScanSearch, Stamp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocHeader, NextPage, Section } from "@/components/docs/Prose";
import { addressUrl, chain, REGISTRY } from "@/lib/config";

export const metadata: Metadata = { title: "Overview | Clipright docs" };

const flow = [
  { icon: Mic, title: "Record", body: "While a creator streams, their browser fingerprints the sound and picture of every second." },
  { icon: Stamp, title: "Stamp", body: "Each minute becomes one short code, signed with the creator's passkey and written to Monad." },
  { icon: ScanSearch, title: "Check", body: "Anyone drops a clip. Clipright names the stream and the second it came from, or says no match." },
];

export default function DocsOverview() {
  return (
    <>
      <DocHeader
        eyebrow="Overview"
        title="Proof that a clip really came from the stream."
        lead="Drop a short video clip into Clipright. It tells you which stream it came from, down to the second, or tells you plainly that it does not match anything on record."
      />

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {flow.map((f, i) => (
          <div key={f.title} className="relative rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-ink text-paper">
                <f.icon size={18} />
              </span>
              <span className="font-mono text-xs text-muted">0{i + 1}</span>
            </div>
            <p className="mt-4 font-display text-lg font-semibold">{f.title}</p>
            <p className="mt-1 text-sm text-muted">{f.body}</p>
          </div>
        ))}
      </div>

      <Section id="problem" title="The problem">
        <p>
          Most people never watch a livestream live. They see it as a 30-second clip on TikTok, Shorts, Reels or X, cut by someone else, cropped to vertical,
          with captions on top. Two questions have no good answer today:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Is this clip real?</strong> A clip can be edited, stitched or partly generated and still look like it came from the stream.
          </li>
          <li>
            <strong>Who checked it?</strong> Clipping is a paid job, and whether a clip is a faithful cut is decided by a person, by eye, inside one platform's
            private system.
          </li>
        </ul>
        <p>Large rights holders have tools such as YouTube's Content ID, but those are closed to most individual creators and only work on one platform.</p>
      </Section>

      <Section id="answer" title="What Clipright does about it">
        <p>
          Think of a notary sitting next to the stream, stamping every minute. The stamps are public, on Monad, and nobody can change them afterwards. A clip is
          checked against those stamps in the viewer's own browser, so the answer does not depend on trusting Clipright's server.
        </p>
        <Callout tone="good" title="The video never leaves the creator's device">
          Only fingerprints are stored, and only one code per minute goes onchain.
        </Callout>
      </Section>

      <Section id="try" title="Try it now">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/check", title: "Check a clip", body: "Drop any video file." },
            { href: "/live", title: "Stamp a stream", body: "Stamp the stream you already run on Twitch, YouTube or X." },
            { href: "/docs/test-it", title: "Test it yourself", body: "Make clips that try to fool it." },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="group rounded-2xl border border-line bg-card p-5 transition hover:border-ink">
              <p className="font-medium">{c.title}</p>
              <p className="mt-1 text-sm text-muted">{c.body}</p>
              <ArrowRight size={16} className="mt-3 text-muted transition group-hover:translate-x-1 group-hover:text-ink" />
            </Link>
          ))}
        </div>
      </Section>

      <Section id="status" title="Where it runs">
        <p>
          Clipright runs on {chain.name}. The registry contract is{" "}
          {REGISTRY && addressUrl(REGISTRY) ? (
            <a className="break-all font-mono text-sm underline decoration-line underline-offset-4" href={addressUrl(REGISTRY)!} target="_blank" rel="noreferrer">
              {REGISTRY}
            </a>
          ) : (
            <span className="font-mono text-sm">{REGISTRY || "not deployed"}</span>
          )}
          , and its source is verified on Sourcify. The code is open at{" "}
          <a className="underline decoration-line underline-offset-4" href="https://github.com/AustinChris1/clipright" target="_blank" rel="noreferrer">
            github.com/AustinChris1/clipright
          </a>
          .
        </p>
        <p>Built for Monad Metropolis, Track 04: Trust, Identity and AI Infrastructure.</p>
      </Section>

      <NextPage href="/docs/how-to-use" label="How to use" />
    </>
  );
}
