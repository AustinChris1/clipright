import type { Metadata } from "next";
import { Callout, DocHeader, Section } from "@/components/docs/Prose";

export const metadata: Metadata = { title: "Limits and FAQ | Clipright docs" };

const faqs = [
  {
    q: "Do I have to stop streaming on Twitch or YouTube?",
    a: "No. Clipright is not a streaming platform. Keep streaming where you stream; Clipright runs in a browser tab beside it, listening to your stream's tab, and stamps every minute on Monad.",
  },
  {
    q: "A clip says No Clipright record. Is it fake?",
    a: "Not necessarily. It means nobody stamped the stream it came from, so Clipright has nothing to compare it with. Clipright only vouches for what it witnessed; a clip from an old stream or a show can be perfectly real.",
  },
  {
    q: "Couldn't someone stamp someone else's stream?",
    a: "Yes. Anyone can stamp a tab, including one playing another person's stream. A stamp proves those fingerprints existed at that minute and which key signed them; it does not prove the signer is the performer. A linked wallet is only a name for that key. If two stamps hold the same footage, the earlier one is earlier, not more legitimate.",
  },
  {
    q: "How is this different from C2PA content credentials?",
    a: "Content credentials are signed data carried inside the file, and they often get stripped when a clip is re-uploaded. Clipright matches the sound and the picture themselves, so a cropped, captioned, re-encoded copy still lines up with the stamped stream.",
  },
  {
    q: "Is my video uploaded anywhere?",
    a: "No. Fingerprinting happens in your browser. Only the fingerprints of a stamped stream are stored, and a clip you check never leaves your device. The one exception is Find a lead, which you press yourself: it sends 8 small frames and up to 30 seconds of sound to Google's Gemini, and the transcribed lines to Wikiquote. The clip file itself is not sent.",
  },
  {
    q: "Do I need a crypto wallet or MON?",
    a: "No. Your passkey creates the stamping key, and Clipright's relayer pays the gas. The key signs stamps and never holds funds.",
  },
  {
    q: "Can Clipright fake a match?",
    a: "Not without detection. Your browser re-hashes the fingerprint files and compares them with roots read directly from Monad, and the contract checks a proof for one matched second.",
  },
  {
    q: "Can someone fake a shareable link?",
    a: "Not the result. The server matches the clip's fingerprint against the stamped stream itself before it makes a link, and the link page asks Monad again every time it is opened. What a link proves is that a clip with that fingerprint was checked, so the page lets anyone drop the clip they saw and compare it, in their own browser.",
  },
  {
    q: "Why Monad? Could it run on another chain?",
    a: "The contract is plain Solidity, so it could run on any EVM chain. Monad fits because a stamp every minute for every stream needs three things together: fees low enough for 360 stamps per six-hour stream (about $0.10 on Monad testnet), finality the protocol guarantees in about 0.6 s rather than a rollup sequencer's promise that settles on Ethereum later, and throughput for thousands of streams stamping at once (10,000 live streams is about 170 stamps a second).",
  },
  {
    q: "Can I stamp an old recording?",
    a: "Only at the pace it plays: minute m cannot be stamped until m minutes after the stream was opened. A stamp proves the footage existed by the time it was stamped, not when it was filmed.",
  },
  {
    q: "Can it tell me where a TV or film clip is from?",
    a: "Not with proof, because nobody stamped it. Find a lead transcribes the lines and searches Wikiquote for them exactly, which often names the show or film with a page you can check. In our tests a line from Invincible was found this way. Gemini's own guess is shown too, labelled unverified, because AI models also name the wrong film with high confidence.",
  },
  {
    q: "Why does the sound matter so much?",
    a: "Clips almost always keep the stream's sound, and sound survives cropping and captions. Pictures are the backup when the sound was swapped.",
  },
  {
    q: "What if the clip is mirrored, sped up or heavily zoomed?",
    a: "Those were not part of our tests. Expect weaker or no matches; the per-second cells show how much lined up.",
  },
];

export default function Faq() {
  return (
    <>
      <DocHeader eyebrow="Limits and FAQ" title="The limits, up front." lead="These are part of the design, not fine print." />

      <Section id="limits" title="What Clipright does not do">
        <div className="space-y-3">
          <Callout tone="limit" title="It is not a deepfake detector">
            It proves whether footage lines up with what was stamped. It cannot judge a video that was never stamped.
          </Callout>
          <Callout tone="limit" title="Replaced audio weakens the match">
            If a clip swaps the stream&apos;s sound for a song, only the picture check is left, and that works only when the full frame or centre crop lines up.
          </Callout>
          <Callout tone="limit" title="It does not count views or catch bot views">
            Where a clip came from is a separate question from how many real people watched it.
          </Callout>
          <Callout tone="limit" title="It only covers streams that were stamped">
            Footage from before a creator started stamping cannot be checked. Find a lead can point to where an unstamped clip may be from, but it is a
            lead, not proof.
          </Callout>
          <Callout tone="warn" title="Testnet, for now">
            Clipright runs on Monad testnet during the hackathon, with demo limits on how many stamps the relayer pays for.
          </Callout>
        </div>
      </Section>

      <Section id="faq" title="Questions">
        <div className="divide-y divide-line rounded-2xl border border-line bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="mr-2 inline-block text-stamp transition group-open:rotate-45">+</span>
                {f.q}
              </summary>
              <p className="mt-2 pl-5 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
