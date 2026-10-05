import type { Metadata } from "next";
import { Callout, DocHeader, NextPage, Section, Steps, Table } from "@/components/docs/Prose";

export const metadata: Metadata = { title: "How to use | Clipright docs" };

export default function HowToUse() {
  return (
    <>
      <DocHeader
        eyebrow="How to use"
        title="Check a clip, or stamp your own stream."
        lead="Two jobs, two pages. Checking needs nothing but a video file. Stamping needs a browser with a passkey."
      />

      <Section id="try" title="Try it first">
        <p>
          The fastest way to see Clipright work is{" "}
          <a className="underline decoration-line underline-offset-4" href="/try">
            Try it
          </a>
          : record one sentence, and it stamps it, cuts a word out of a copy, and checks both.
        </p>
      </Section>

      <Section id="check" title="Check a clip">
        <Steps
          items={[
            { title: "Open Check a clip", body: "Go to /check. Nothing to sign in to." },
            { title: "Drop a video file", body: "MP4, MOV or WebM, or an audio file. It is fingerprinted in your browser and never uploaded." },
            {
              title: "Read the verdict",
              body: "Match: the stream and the exact time range. Edited from a stamped stream: what was cut out or added, and where. Pictures match, sound does not: the soundtrack was replaced or altered. No Clipright record: nothing stamped lines up. That does not make the clip fake; it just was not stamped while it aired.",
            },
            {
              title: "Share the result",
              body: "After a match, press Get a shareable link and post it next to the clip. The link page shows the verdict, asks Monad again for every viewer, and lets anyone drop their copy to confirm it is the same clip. When posted on X or Discord, the link previews as a card with the verdict.",
            },
            {
              title: "Look at the evidence",
              body: "One coloured cell per second shows whether sound, picture or both matched. The side panel shows each minute re-hashed in your browser and compared with Monad.",
            },
          ]}
        />
        <Table
          head={["Cell colour", "Meaning"]}
          rows={[
            [<span key="a" className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-match" />Green</span>, "Sound and picture both match this second."],
            [<span key="b" className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-match/55" />Light green</span>, "Sound matches; the picture could not be compared."],
            [<span key="c" className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-warn/70" />Amber</span>, "Only the picture matches."],
            [<span key="d" className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-stamp" />Red</span>, "Nothing matches this second."],
            [<span key="f" className="inline-flex items-center gap-2"><span className="size-3 rounded-sm bg-line" />Grey</span>, "Silence in the clip, such as a pause. It counts as neither a match nor an edit."],
            [<span key="e" className="inline-flex items-center gap-2"><span className="h-3 w-1 rounded-full bg-warn" />Amber bar</span>, "A cut: the clip jumps forward in the stream here."],
          ]}
        />
        <Callout title="No match? Find a lead">
          A clip from a show, a film, or a stream nobody stamped never matches. Under a no match, Clipright first shows any lead already found for the same
          clip, marked seen before, using only its sound fingerprint. To look further, press Find a lead. Clipright sends 8 small frames and up to
          30 seconds of sound to Google&apos;s Gemini, which writes down what is said. Those exact lines are searched on Wikiquote, and anime frames on
          trace.moe. Catalog hits are shown in green with a link to check; Gemini&apos;s own guess is shown in amber as unverified. A lead is not proof, and it
          is never written to Monad.
        </Callout>
        <Callout title="Same footage in several streams?">
          If a clip lines up with more than one stamped stream, Clipright lists all of them and marks the one stamped first onchain. That is how a re-stream of
          someone else's content shows up.
        </Callout>
      </Section>

      <Section id="live" title="Stamp your stream">
        <p>
          Keep streaming on Twitch, YouTube or X. Clipright runs in a browser tab beside your stream and stamps it; it never hosts or uploads the video. The page
          is called Stamp a stream.
        </p>
        <Steps
          items={[
            {
              title: "Create a passkey",
              body: "On Stamp a stream, press Create a passkey and confirm with Face ID, Touch ID or your device PIN. This creates your stamping key. It signs stamps and never holds money.",
            },
            { title: "Open a stream", body: "Give it a title and press Open stream. This is a transaction on Monad; Clipright pays the gas." },
            {
              title: "Share your stream",
              body: "Keep streaming on Twitch, YouTube or X as usual. Open your live stream in a browser tab, press Share your stream's tab, pick that tab and tick Share tab audio: the sound carries most of the fingerprint, and sharing an OBS window usually captures none. The camera option stamps this device's webcam and microphone instead.",
            },
            {
              title: "Start stamping",
              body: "Each finished minute appears in the Stamps list with its Monad transaction. A minute is stamped a few seconds after it ends.",
            },
            { title: "Stop", body: "The last, shorter minute is stamped too. Download the recording if you want to cut clips from it." },
            {
              title: "Link your wallet (optional)",
              body: "Connect any wallet through Dynamic and press Link this wallet. Your wallet and your passkey key both sign one message, Clipright pays the gas, and your streams appear on a public creator page at /creators/<your wallet>. Matching checks then name you as the creator.",
            },
          ]}
        />
        <Callout tone="warn" title="Which devices work">
          Passkeys must support key derivation (the WebAuthn PRF extension). iPhone on iOS 18 or later, Mac with macOS 15 or later using iCloud Keychain,
          Android with Google Password Manager, or 1Password in any browser. Desktop Chrome with a passkey saved only in the browser profile does not work. On
          those devices, the tab-only key works but disappears when you close the tab.
        </Callout>
      </Section>

      <Section id="rules" title="Rules the network enforces">
        <Table
          head={["Rule", "Why"]}
          rows={[
            ["A minute can be stamped once, and never changed", "The record is append-only, so it cannot be rewritten after a clip goes viral."],
            ["Minute 5 cannot be stamped until 5 minutes after the stream opened", "Stamps cannot run ahead of real time."],
            ["Every stamp must be signed by the stream's key", "Nobody else can add minutes to your stream, even though the relayer submits them."],
            ["This demo relays up to 20 new streams an hour, 300 stamps a day, 240 minutes a stream", "It protects the gas wallet on a public site."],
          ]}
        />
      </Section>

      <NextPage href="/docs/use-cases" label="Use cases" />
    </>
  );
}
