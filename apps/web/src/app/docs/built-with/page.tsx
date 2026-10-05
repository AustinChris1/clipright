import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Callout, Code, DocHeader, NextPage, Section, Table } from "@/components/docs/Prose";

export const metadata: Metadata = { title: "Built with | Clipright docs" };

const REPO = "https://github.com/AustinChris1/clipright/blob/main/";

function Src({ path }: { path: string }) {
  return (
    <a href={REPO + path} target="_blank" rel="noreferrer" className="font-mono text-xs underline decoration-line underline-offset-4">
      {path.split("/").slice(-2).join("/")}
    </a>
  );
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="underline decoration-line underline-offset-4">
      {children}
    </a>
  );
}

const files = (...paths: string[]) => (
  <span className="flex flex-col gap-1">
    {paths.map((p) => (
      <Src key={p} path={p} />
    ))}
  </span>
);

export default function BuiltWith() {
  return (
    <>
      <DocHeader
        eyebrow="Built with"
        title="What each piece does, and where to see it."
        lead="Every tool below drives a feature you can open on the live site. Each section names the feature, the page that shows it, and the code."
      />

      <Section id="monad" title="Monad">
        <p>
          The public record. <Code>StampRegistry</Code> stores one Merkle root per stream minute, signed by the stream&apos;s key, and checks any one second&apos;s
          proof onchain with <Code>verifySecond</Code>. Blocks of 300 ms and finality after two blocks put each minute on record before a clip of it can be cut
          and posted. A minute cannot be stamped before it could have happened, so a stream stamps no faster than real time.
        </p>
        <Table
          head={[]}
          rows={[
            ["Feature", "Stamping every minute live; the Verified on Monad panel on every match"],
            ["See it", <A key="s" href="/check">Check a clip, then the panel on the right</A>],
            ["Code", files("packages/contracts/contracts/StampRegistry.sol", "apps/web/src/lib/server/relayer.ts", "apps/web/src/lib/client/api.ts")],
          ]}
        />
      </Section>

      <Section id="envio" title="Envio HyperSync">
        <p>
          The memory. Monad&apos;s public RPC answers <Code>eth_getLogs</Code> for 100 blocks at a time, about 30 seconds. Clipright reads the full history of
          both contracts&apos; events (<Code>StreamOpened</Code>, <Code>Stamped</Code>, <Code>Linked</Code>) from HyperSync&apos;s query API, from the
          deployment block onward, and keeps scanning forward. Without it, a stream opened more than a minute ago would vanish from the app.
        </p>
        <p>Four features run on that event stream:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Which streams a clip is checked against.</strong> The check page asks for the stream list, and the list comes from <Code>StreamOpened</Code>{" "}
            events.
          </li>
          <li>
            <strong>Creator pages and &quot;Stamped by&quot;.</strong> <Code>Linked</Code> events map each stamping key to its wallet, for{" "}
            <Code>/creators/&lt;wallet&gt;</Code> and the line under a match.
          </li>
          <li>
            <strong>The streams list</strong> with minute counts from <Code>Stamped</Code>.
          </li>
          <li>
            <strong>Gas protection.</strong> The relayer counts the last hour&apos;s opens and links and the last day&apos;s stamps from these events, so every
            server instance agrees on the limits without a database.
          </li>
        </ul>
        <Table
          head={[]}
          rows={[
            ["Feature", "Stream discovery for checks, creator pages, streams list, relayer limits"],
            ["See it", <A key="s" href="/streams">Streams, which shows &quot;Read from Monad via Envio HyperSync&quot;</A>],
            ["Code", files("apps/web/src/lib/server/chainEvents.ts", "apps/web/src/lib/server/listings.ts", "apps/web/src/lib/server/limits.ts")],
          ]}
        />
      </Section>

      <Section id="mera" title="Mera">
        <p>
          The stamping key without a wallet. The creator&apos;s passkey is evaluated with the WebAuthn PRF extension and Clipright&apos;s own salt,{" "}
          <Code>sha256(&quot;clipright.stamp.v1&quot;)</Code>, and Mera turns the 32 bytes into a secp256k1 signing session. Face ID or a fingerprint gets the
          same key back on any device that syncs the passkey. The key signs stamps and never holds funds; the relayer pays gas.
        </p>
        <Table
          head={[]}
          rows={[
            ["Feature", "Create a passkey, Use my existing passkey"],
            ["See it", <A key="s" href="/live">Stamp a stream, step 1</A>],
            ["Code", files("apps/web/src/lib/client/passkey.ts")],
          ]}
        />
      </Section>

      <Section id="dynamic" title="Dynamic">
        <p>
          The creator&apos;s identity. A passkey key is anonymous, so a creator connects any wallet through Dynamic and links it. The wallet and the stamping key
          both sign one message, and <Code>CreatorLinks</Code> checks both signatures (smart wallets through ERC-1271) before recording the link. From then
          on every match names the creator&apos;s wallet, and their streams appear on a public page.
        </p>
        <Table
          head={[]}
          rows={[
            ["Feature", "Link this wallet; Stamped by on a match; creator pages"],
            ["See it", <A key="s" href="/live">Stamp a stream, after creating a key</A>],
            ["Code", files("apps/web/src/components/wallet/WalletProvider.tsx", "apps/web/src/components/wallet/LinkWallet.tsx", "packages/contracts/contracts/CreatorLinks.sol")],
          ]}
        />
      </Section>

      <Section id="leads" title="Gemini, Whisper on Groq, Wikiquote, trace.moe">
        <p>
          Leads for clips that are not on record. Gemini writes down the spoken lines from the sound and describes 8 frames; Whisper on Groq writes down the
          speech when Gemini is busy. Each line is searched as an exact phrase on Wikiquote, and the middle frame on trace.moe for anime. Catalog hits are cached
          by sound fingerprint in Postgres on Neon, so the next person with the same clip sees the lead at once.
        </p>
        <Table
          head={[]}
          rows={[
            ["Feature", "Find a lead, and seen before, under a no match"],
            ["See it", <A key="s" href="/docs/test-it#clips">Check test clip C, then press Find a lead</A>],
            ["Code", files("apps/web/src/app/api/identify/route.ts", "apps/web/src/lib/server/leads.ts", "apps/web/src/components/check/Identify.tsx")],
          ]}
        />
      </Section>

      <Callout tone="good" title="Read without Clipright">
        Everything a check relies on is public: the roots and proofs on Monad, the event history through any HyperSync client, and the fingerprint files over{" "}
        <Code>GET /api/streams/:id</Code>. Your browser re-hashes the files and compares them with Monad itself.
      </Callout>

      <NextPage href="/docs/faq" label="Limits and FAQ" />
    </>
  );
}
