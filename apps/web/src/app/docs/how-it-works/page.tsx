import type { Metadata } from "next";
import { Callout, Code, DocHeader, NextPage, Section, Table } from "@/components/docs/Prose";

export const metadata: Metadata = { title: "How it works | Clipright docs" };

function MinuteDiagram() {
  return (
    <figure className="rounded-2xl border border-line bg-card p-5">
      <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1" aria-hidden>
        {Array.from({ length: 60 }, (_, i) => (
          <div key={i} className={`h-5 rounded-sm ${i === 42 ? "bg-stamp" : "bg-ink/15"}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
        <span>60 seconds, one fingerprint each</span>
        <span>→</span>
        <span className="rounded bg-ink px-2 py-0.5 text-paper">one Merkle root</span>
        <span>→</span>
        <span className="rounded bg-stamp px-2 py-0.5 text-white">signed, stamped on Monad</span>
      </div>
      <figcaption className="mt-3 text-sm text-muted">
        To prove second 42 belongs to a stamped minute, you only need that second's fingerprint and six sibling hashes, not the other 59 seconds.
      </figcaption>
    </figure>
  );
}

export default function HowItWorks() {
  return (
    <>
      <DocHeader
        eyebrow="How it works"
        title="Fingerprints, one code a minute, and a public record."
        lead="Everything here runs as plain TypeScript in the browser, plus one small contract on Monad. The same engine code runs on the server for tests."
      />

      <Section id="sound" title="1. Sound fingerprints">
        <p>
          The stream's audio is converted to 8,000 samples a second and turned into a spectrogram, a picture of which frequencies are loud at each moment. The
          engine keeps the strongest peaks, up to 30 a second, and pairs each peak with a few that follow it. Each pair becomes a small hash: the first peak's
          frequency, the second's, and the time between them.
        </p>
        <p>
          This is the idea behind song-recognition apps. Captions, cropping and re-compression barely move those peaks, so a 15-second clip still produces
          hundreds of the same hashes. Matching counts which time offset most of the clip's hashes agree on. In the test suite, the right offset collected 406
          agreeing hashes and the next best collected 5.
        </p>
      </Section>

      <Section id="picture" title="2. Picture fingerprints">
        <p>
          Each second, the frame at the half-second mark is shrunk to 64 by 64 grey pixels and reduced to a 256-bit hash, in the style of Meta's PDQ. Two
          frames that look alike have hashes that differ in few bits.
        </p>
        <p>
          A vertical clip keeps only about a third of a widescreen frame, which breaks this kind of hash. So the stream side hashes two versions in advance: the
          full frame and the centre 9:16 crop. In the test suite, matching frames were 14 to 40 bits apart and unrelated video never came closer than 90.
        </p>
      </Section>

      <Section id="minute" title="3. One code per minute">
        <MinuteDiagram />
        <p>
          Every second's sound and picture fingerprints are hashed into a leaf, and the minute's 60 leaves are combined into a Merkle root. The fingerprint
          files are stored publicly off-chain; the root on Monad is what makes them tamper evident, because changing one landmark changes the root.
        </p>
      </Section>

      <Section id="stamp" title="4. Stamping with a passkey">
        <p>
          The creator's passkey is evaluated through Mera with Clipright's own salt, <Code>sha256(&quot;clipright.stamp.v1&quot;)</Code>. The 32 bytes that come
          back become a signing key used only for stamps. The same passkey with a different salt would give an unrelated key, so this key is separate from any
          wallet.
        </p>
        <p>
          The browser signs each minute's root. Clipright's relayer checks that the file really hashes to that root and that the signature comes from the
          stream's key, then submits it and pays the gas. The contract checks the signature again, refuses to overwrite a stamped minute, and refuses minute{" "}
          <Code>m</Code> until <Code>m</Code> minutes after the stream opened.
        </p>
      </Section>

      <Section id="check" title="5. Checking a clip">
        <p>The clip is decoded and fingerprinted in the viewer's browser. Then:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Its sound hashes are compared with every stamped stream to find the offset most of them agree on.</li>
          <li>If the sound does not match, its pictures vote on an offset instead.</li>
          <li>Each second gets a sound count and a picture distance, shown as one coloured cell.</li>
          <li>
            For each matched minute, the browser re-hashes the fingerprint file, reads the root from Monad directly, and asks the contract&apos;s{" "}
            <Code>verifySecond</Code> to check one second&apos;s proof onchain.
          </li>
        </ol>
        <Callout tone="good" title="Why this matters">
          A dishonest server cannot fake a match: it would have to forge fingerprint files that hash to roots already stamped on Monad.
        </Callout>
      </Section>

      <Section id="lead" title="When nothing is on record">
        <p>
          A no match is the honest answer for footage nobody stamped. The browser first sends the clip&apos;s sound landmarks, never the sound itself, to{" "}
          <Code>/api/leads</Code>. They are matched with the same offset histogram as stamped streams against clips someone already found a lead for, so a
          re-upload or re-crop of a known clip gets its lead at once. If the viewer asks for more, the server runs three lookups and keeps them apart:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Google&apos;s Gemini gets 8 small frames and up to 30 seconds of 8 kHz sound. It writes down the spoken lines word for word and describes the scene. If Gemini is busy or out of free quota, Whisper on Groq writes down
            the speech instead, with no scene description.
          </li>
          <li>
            Each line is searched as an exact phrase on Wikiquote, an open catalog of film and TV dialogue. A hit links to the page that quotes it.
          </li>
          <li>The middle frame is sent to trace.moe, which finds anime episodes and the minute; only matches above 92% similarity are shown.</li>
        </ol>
        <Callout tone="warn" title="Why the AI guess is labelled unverified">
          In testing, Gemini named an open-source short film as a different film with 95% confidence. Transcribing speech was reliable; naming titles was
          not. So catalog hits are shown as leads with a link, the AI&apos;s title as a guess, and no AI confidence score is displayed. Only catalog hits are cached for the next viewer, never the AI&apos;s guess.
        </Callout>
      </Section>

      <Section id="history" title="6. Reading the record">
        <p>
          The list of streams and the &quot;stamped first&quot; ordering come from the registry&apos;s events. Monad&apos;s public RPC answers{" "}
          <Code>eth_getLogs</Code> for at most 100 blocks at a time, about 30 seconds of history, so Clipright reads the full history through Envio HyperSync.
        </p>
      </Section>

      <Section id="numbers" title="Measured numbers">
        <Table
          head={["What", "Value", "Source"]}
          rows={[
            ["Block time", "300 ms", "Monad docs; 0.302 s measured over 20,000 testnet blocks"],
            ["Finality", "After two blocks, 600 ms", "Monad docs"],
            ["Cost of one stamp", "0.0107 MON", "A real testnet stamp: 104,982 gas at 102 gwei"],
            ["A six-hour stream", "360 stamps, about 3.85 MON", "About $0.10 to $0.11 at MON $0.027 to $0.029"],
            ["Offset accuracy", "Within 3 ms on the test clips", "47.297 s found for a clip cut at 47.3 s"],
          ]}
        />
      </Section>

      <NextPage href="/docs/test-it" label="Test it yourself" />
    </>
  );
}
