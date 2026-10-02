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
              body: "Match: the stream and the exact time range. Pictures match, sound does not: the soundtrack was replaced or altered. No match: nothing on record lines up.",
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
            [<span key="e" className="inline-flex items-center gap-2"><span className="h-3 w-1 rounded-full bg-warn" />Amber bar</span>, "A cut: the clip jumps forward in the stream here."],
          ]}
        />
        <Callout title="Same footage in several streams?">
          If a clip lines up with more than one stamped stream, Clipright lists all of them and marks the one stamped first onchain. That is how a re-stream of
          someone else's content shows up.
        </Callout>
      </Section>

      <Section id="live" title="Stamp your stream">
        <Steps
          items={[
            {
              title: "Create a passkey",
              body: "On /live, press Create a passkey and confirm with Face ID, Touch ID or your device PIN. This creates your stamping key. It signs stamps and never holds money.",
            },
            { title: "Open a stream", body: "Give it a title and press Open stream. This is a transaction on Monad; Clipright pays the gas." },
            {
              title: "Pick a source",
              body: "Camera uses your webcam and microphone. Tab or screen lets you share a browser tab; tick Share tab audio, because the sound carries most of the fingerprint.",
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
