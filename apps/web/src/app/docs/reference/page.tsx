import type { Metadata } from "next";
import { Block, Code, DocHeader, NextPage, Section, Table } from "@/components/docs/Prose";
import { addressUrl, chain, CHAIN_ID, REGISTRY } from "@/lib/config";

export const metadata: Metadata = { title: "Contract and API | Clipright docs" };

export default function Reference() {
  const explorer = REGISTRY ? addressUrl(REGISTRY) : null;
  return (
    <>
      <DocHeader
        eyebrow="Contract and API"
        title="For builders and reviewers."
        lead="One contract holds the record. A small HTTP API relays stamps and serves fingerprint files. Anything the API says can be checked against the contract."
      />

      <Section id="contract" title="StampRegistry">
        <Table
          head={["Network", "Chain id", "Address"]}
          rows={[
            [
              chain.name,
              String(CHAIN_ID),
              explorer ? (
                <a key="a" className="break-all font-mono text-xs underline decoration-line underline-offset-4" href={explorer} target="_blank" rel="noreferrer">
                  {REGISTRY}
                </a>
              ) : (
                <span key="a" className="font-mono text-xs">{REGISTRY || "not deployed"}</span>
              ),
            ],
          ]}
        />
        <p>
          Source verified on{" "}
          <a className="underline decoration-line underline-offset-4" href={`https://sourcify.dev/server/repo-ui/${CHAIN_ID}/${REGISTRY}`} target="_blank" rel="noreferrer">
            Sourcify
          </a>
          . Solidity source: <Code>packages/contracts/contracts/StampRegistry.sol</Code>.
        </p>
        <Table
          head={["Function", "What it does"]}
          rows={[
            [<Code key="1">openStream(signer, meta, sig)</Code>, "Opens a stream owned by signer. sig signs openDigest(signer, nonce, meta). Emits StreamOpened."],
            [<Code key="2">stamp(streamId, minute, root, sig)</Code>, "Records a minute's root once. sig signs stampDigest(streamId, minute, root). Emits Stamped."],
            [<Code key="3">verifySecond(streamId, minute, second, audioDigest, pictureFull, pictureCenter, proof)</Code>, "True if that second's fingerprints are in the stamped minute, plus the stamp time."],
            [<Code key="4">secondLeaf(...)</Code>, "The leaf hash for one second, identical to the engine's secondLeaf."],
            [<Code key="5">streams(id), stamps(id, minute), nonces(signer)</Code>, "Public state: signer, open time, stamp count; each minute's root and time; open nonces."],
          ]}
        />
        <Table
          head={["Error", "When"]}
          rows={[
            [<Code key="a">BadSignature</Code>, "The signature is not from the stream's key, or a nonce was reused."],
            [<Code key="b">AlreadyStamped</Code>, "That minute already has a root."],
            [<Code key="c">TooEarly</Code>, "Minute m was sent before m minutes had passed since the stream opened."],
            [<Code key="d">UnknownStream</Code>, "No stream with that id."],
            [<Code key="e">EmptyRoot</Code>, "The root is zero."],
          ]}
        />
        <p>Signatures are EIP-191 personal signatures over the 32-byte digest.</p>
        <p>
          <span className="font-medium">CreatorLinks</span> ties a stamping key to a creator wallet:{" "}
          <Code>link(signer, owner, signerSig, ownerSig)</Code> needs both signatures over <Code>linkDigest(signer, owner, nonce)</Code>, accepts smart
          wallets (ERC-1271), and emits <Code>Linked</Code>. <Code>ownerOf(signer)</Code> returns the current wallet. Source:{" "}
          <Code>packages/contracts/contracts/CreatorLinks.sol</Code>.
        </p>
      </Section>

      <Section id="api" title="HTTP API">
        <Table
          head={["Endpoint", "Returns"]}
          rows={[
            [<Code key="1">GET /api/config</Code>, "Chain id, registry address and RPC URL."],
            [<Code key="2">GET /api/streams</Code>, "Every stream opened on the registry, from onchain events, and whether fingerprints are stored here."],
            [<Code key="3">GET /api/streams/:id</Code>, "The stream's metadata, stamp receipts and minute fingerprint files."],
            [<Code key="4">POST /api/streams</Code>, "Relays openStream. Body: signer, title, sig."],
            [<Code key="5">POST /api/streams/:id/minutes</Code>, "Relays one stamp. Body: the minute file and sig. 425 with retryAfter if the minute is early."],
            [<Code key="6">POST /api/links</Code>, "Relays a wallet link. Body: signer, owner, signerSig, ownerSig."],
            [<Code key="7">POST /api/identify</Code>, "Leads for an unstamped clip. Body: frames (up to 10 base64 JPEGs) and audio (base64 WAV). Returns the transcribed lines, Wikiquote and trace.moe hits, and Gemini's unverified guess. 8 a minute."],
          ]}
        />
        <p>A minute file, abridged:</p>
        <Block label="minute-0.json">{`{
  "v": 1,
  "streamId": "0x…",
  "minute": 0,
  "root": "0x…",
  "seconds": [
    { "s": 0, "a": [[hash, frame], …], "pf": "0x…", "pc": "0x…" }
  ]
}`}</Block>
        <p>
          <Code>a</Code> holds the second&apos;s sound landmarks, <Code>pf</Code> and <Code>pc</Code> the full-frame and centre-crop picture hashes. Recomputing
          the root from this file must give the root stamped onchain.
        </p>
      </Section>

      <NextPage href="/docs/faq" label="Limits and FAQ" />
    </>
  );
}
