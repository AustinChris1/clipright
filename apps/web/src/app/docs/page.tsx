import { AppWindow, ArrowRight, ScanSearch, Stamp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocHeader, NextPage, Section } from "@/components/docs/Prose";
import { addressUrl, chain, REGISTRY } from "@/lib/config";

export const metadata: Metadata = { title: "Overview | Clipright docs" };

const flow = [
  { icon: AppWindow, title: "Record", body: "The creator streams on Twitch, YouTube or X as usual. Clipright fingerprints the sound and picture of their stream's tab, every second." },
  { icon: Stamp, title: "Stamp", body: "Each minute becomes one short code, signed with the creator's passkey and written to Monad." },
  { icon: ScanSearch, title: "Check", body: "Anyone drops a clip and gets the stream, the second and anything cut out, plus a link to post beside the clip. Or: no Clipright record." },
];

export default function DocsOverview() {
  return (
    <>
      <DocHeader
        eyebrow="Overview"
        title="Proof that a clip really came from the stream."
        lead="Creators keep streaming where they stream, and Clipright stamps beside it. Later, anyone can drop a clip and learn which stream it came from, down to the second, and whether anything was cut out."
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
        <Callout tone="good" title="Not a streaming platform">
          Twitch, YouTube or X host the stream. Clipright never hosts the video: only fingerprints are stored, and only one code per minute goes onchain.
        </Callout>
        <p>
          A clip with no record is not called fake. It simply was not stamped while it aired, and Clipright says exactly that. It vouches only for what it
          witnessed.
        </p>
      </Section>

      <Section id="try" title="Try it now">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/try", title: "Try it in a minute", body: "Say one sentence and watch a cut get caught." },
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
