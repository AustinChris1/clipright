import type { Metadata } from "next";
import { Callout, DocHeader, NextPage, Section } from "@/components/docs/Prose";

export const metadata: Metadata = { title: "Use cases | Clipright docs" };

function Case({ who, scenario, steps, result }: { who: string; scenario: string; steps: string[]; result: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="font-mono text-xs uppercase tracking-wider text-stamp">{who}</p>
      <p className="mt-2 font-medium">{scenario}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="mt-3 text-sm">
        <span className="font-medium">Outcome: </span>
        {result}
      </p>
    </div>
  );
}

export default function UseCases() {
  return (
    <>
      <DocHeader
        eyebrow="Use cases"
        title="Who checks clips, and why."
        lead="Each example below is a real situation in the clip economy, walked through with what Clipright actually does today."
      />

      <Section id="creators" title="Creators">
        <Case
          who="Streamer"
          scenario="A 12-second clip of you saying something you never said is spreading."
          steps={[
            "You stamped that stream as you went live.",
            "You drop the viral clip into Check a clip.",
            "The sound only partly lines up, and the seconds that were changed show red.",
          ]}
          result="You can point anyone to a public record of what you actually said, and to the seconds that do not match it."
        />
        <Case
          who="Streamer"
          scenario="Another channel re-streams your footage as if it were theirs."
          steps={["Both streams get stamped.", "A clip from either one matches both.", "Clipright marks which stream was stamped first onchain."]}
          result="The earlier stamp is a timestamped, public claim to the footage."
        />
      </Section>

      <Section id="viewers" title="Viewers and journalists">
        <Case
          who="Journalist"
          scenario="A clip of a public figure on a livestream is going viral and you need to know if it is genuine before writing about it."
          steps={["Download the clip.", "Drop it into Check a clip.", "Read the stream, the time range and the per-second evidence."]}
          result="Either a match you can cite, with the onchain stamp times, or a clear no match, meaning the clip is not from any stamped stream."
        />
      </Section>

      <Section id="clippers" title="Clippers and clipping campaigns">
        <Case
          who="Clipper"
          scenario="You are paid per view to cut moments from a streamer's broadcasts, and the campaign asks for proof that your clip is a faithful cut."
          steps={["You cut and post your clip as usual: vertical, captioned.", "You or the campaign drops it into Check a clip."]}
          result="A second-accurate match against the streamer's own stamps, instead of someone reviewing it by eye."
        />
        <Callout tone="limit" title="What this does not cover">
          Clipright confirms where footage came from. It does not count views or detect bought views; that still comes from the platform.
        </Callout>
      </Section>

      <Section id="markets" title="Markets that settle on what happened in a stream">
        <Case
          who="Prediction market or game"
          scenario="A market resolves on a moment in a livestream, and someone disputes the outcome with a clip."
          steps={["The broadcaster stamps the stream.", "The disputed clip is checked against the stamps."]}
          result="The clip either lines up with the stamped minutes at a stated second, or it does not."
        />
      </Section>

      <NextPage href="/docs/how-it-works" label="How it works" />
    </>
  );
}
