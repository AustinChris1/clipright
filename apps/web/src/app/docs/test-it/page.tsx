import type { Metadata } from "next";
import { Block, Callout, Code, DocHeader, NextPage, Section, Steps, Table } from "@/components/docs/Prose";

export const metadata: Metadata = { title: "Test it yourself | Clipright docs" };

export default function TestIt() {
  return (
    <>
      <DocHeader
        eyebrow="Test it yourself"
        title="Try to fool it."
        lead="Stamp your own footage, cut clips from it the way clippers do, and see what Clipright says. No install needed for the first path."
      />

      <Section id="browser" title="In the browser, about five minutes">
        <Steps
          items={[
            {
              title: "Stamp two minutes",
              body: "On /live, create a passkey, open a stream and share a tab playing something you own with Share tab audio ticked. Let it run a little over two minutes, then Stop and Download recording.",
            },
            {
              title: "Cut a clip any way you like",
              body: "Crop it to vertical in any editor, add captions, export it. Or use the clip helper below.",
            },
            { title: "Check it", body: "Drop it into /check. You should get a match with the second it starts at." },
            {
              title: "Now try to break it",
              body: "Replace the soundtrack with music, splice in other footage, or check a video you never stamped. Each should be called out.",
            },
          ]}
        />
      </Section>

      <Section id="helper" title="The clip helper">
        <p>With the repo cloned and installed, this cuts three test clips from any recording:</p>
        <Block label="terminal">{`git clone https://github.com/AustinChris1/clipright
cd clipright && pnpm install
node packages/engine/scripts/make-clips.ts ~/Downloads/clipright-recording.webm 40`}</Block>
        <Table
          head={["File", "What was done", "Expected result"]}
          rows={[
            [<Code key="a">clips/vertical.mp4</Code>, "15 s from 40 s in, 9:16 crop, burned-in caption, re-encoded", "Match at about 40 s"],
            [<Code key="b">clips/sound-swapped.mp4</Code>, "Same pictures, generated music instead of the stream's sound", "Pictures match, sound does not"],
            [<Code key="c">clips/unrelated.mp4</Code>, "A test pattern with music", "No match"],
          ]}
        />
      </Section>

      <Section id="suite" title="The automated test suite">
        <p>These run without a wallet or the network.</p>
        <Block label="terminal">{`pnpm gate   # builds a 2-minute stream and attacks it with five clips
pnpm test   # engine tests and contract tests`}</Block>
        <p>The gate prints what it found for each clip. These are the results from our runs:</p>
        <Table
          head={["Clip", "What was done", "Result"]}
          rows={[
            ["A", "9:16 crop, captions, AAC re-encode", "Matched at 47.297 s (true start 47.3 s)"],
            ["B", "Same pictures, soundtrack replaced", "Sound missed; pictures matched at 47.25 s"],
            ["C", "Unrelated video", "No match"],
            ["D", "Landscape, 480p, low bitrate", "Matched at 88.602 s (true start 88.6 s)"],
            ["E", "5 s of unrelated footage spliced into the middle", "Matched at 47.297 s; the five spliced seconds (52 to 56) flagged red"],
          ]}
        />
        <Callout title="On Windows">The gate makes its test speech with the built-in Windows voice. On macOS or Linux, use the browser path or the clip helper.</Callout>
      </Section>

      <Section id="local" title="Run the whole thing locally">
        <Block label="three terminals">{`cd packages/contracts && npx hardhat node
cd packages/contracts && pnpm deploy:local
cd apps/web && NEXT_PUBLIC_CHAIN_ID=31337 pnpm dev`}</Block>
        <p>
          The web app reads <Code>RELAYER_KEY</Code> from <Code>.env</Code> at the repo root. On a local devnet, fund that address from one of the devnet&apos;s
          test accounts.
        </p>
      </Section>

      <NextPage href="/docs/reference" label="Contract and API" />
    </>
  );
}
